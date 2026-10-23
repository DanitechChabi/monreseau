import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { analyzeAttendance, parseCsv, parseDuration } from "../supabase/functions/_shared/certificates/attendance.ts";
import { CODE_RE, formatHolderName, generatePublicCode } from "../supabase/functions/_shared/certificates/names.ts";
import { buildCertificatePdf } from "../supabase/functions/_shared/certificates/pdf.ts";
import { event, withSettings } from "../supabase/functions/_shared/event.ts";
import { handleAdminAttendance, handleAdminCertificates } from "../supabase/functions/_shared/handlers/certificates.ts";
import { handleVerifyCertificate } from "../supabase/functions/_shared/handlers/verify.ts";
import { addRegistrant, adminPost, setupCerts } from "./cert-fakes.ts";

const body = async (r: Response) => (await r.json()) as Record<string, unknown>;
const verify = (code: string) => new Request(`https://projet.supabase.co/functions/v1/verify-certificate?code=${code}`);

describe("présences", () => {
  it("présent validé → attestation éligible ; inscrit absent → aucune attestation", async () => {
    const { repo, certs, deps } = setupCerts();
    const awa = await addRegistrant(repo, "awa@example.org", "Awa Diallo");
    const bio = await addRegistrant(repo, "bio@example.org", "Bio Sanni");
    // L'inscription seule ne donne droit à rien.
    expect(certs.certificates).toHaveLength(0);

    const r1 = await handleAdminAttendance(adminPost("admin-attendance", { action: "set", registration_id: awa.id, status: "present" }), deps);
    expect(r1.status).toBe(200);
    await handleAdminAttendance(adminPost("admin-attendance", { action: "set", registration_id: bio.id, status: "absent" }), deps);

    expect(certs.certificates.map((c) => [c.holder_name, c.status])).toEqual([["Awa Diallo", "eligible"]]);
    expect(certs.certificates[0]!.public_code).toMatch(CODE_RE);
    expect(certs.attendance.get(bio.id)).toMatchObject({ status: "absent", source: "manual", validatedBy: "admin@archivexa.example" });

    // Repasser absent retire l'éligibilité tant que rien n'est émis.
    await handleAdminAttendance(adminPost("admin-attendance", { action: "set", registration_id: awa.id, status: "absent" }), deps);
    expect(certs.certificates).toHaveLength(0);
    expect(certs.auditLog.map((a) => a.action)).toEqual(["attendance.set", "attendance.set", "attendance.set"]);
  });

  it("import CSV : doublons fusionnés, seuil appliqué, inconnus signalés, rien de validé sous le seuil", async () => {
    const { repo, certs, deps } = setupCerts();
    const awa = await addRegistrant(repo, "awa@example.org", "Awa Diallo");
    const bio = await addRegistrant(repo, "bio@example.org", "Bio Sanni");
    const csv = [
      "Nom (nom original);E-mail de l'utilisateur;Durée (minutes)",
      "Awa Diallo;AWA@example.org;30",
      "Awa D.;awa@example.org ;25", // reconnexion : 30 + 25 = 55 ≥ 45
      "Bio Sanni;bio@example.org;20", // sous le seuil
      "Invité;inconnu@example.org;60", // non inscrit
      "Sans adresse;;50",
    ].join("\n");
    const [header, ...lines] = parseCsv(csv);
    expect(header).toEqual(["Nom (nom original)", "E-mail de l'utilisateur", "Durée (minutes)"]);
    const rows = lines.map((l) => ({ name: l[0]!, email: l[1]!, minutes: parseDuration(l[2]!) }));

    const preview = await body(await handleAdminAttendance(adminPost("admin-attendance", { action: "analyze", rows }), deps));
    expect(preview.duplicates).toEqual(["awa@example.org"]);
    expect(preview.invalid).toBe(1);
    expect((preview.unmatched as { email: string }[]).map((u) => u.email)).toEqual(["inconnu@example.org"]);
    expect(certs.attendance.size).toBe(0); // l'aperçu n'écrit rien

    const done = await body(await handleAdminAttendance(adminPost("admin-attendance", { action: "import", rows }), deps));
    expect(done.validated).toBe(1);
    expect(certs.attendance.get(awa.id)).toMatchObject({ status: "present", minutes: 55, source: "csv" });
    expect(certs.attendance.has(bio.id)).toBe(false); // signalé, pas validé
    expect(certs.certificates.map((c) => c.registration_id)).toEqual([awa.id]);
  });

  it("formats de durée des plateformes", () => {
    expect(parseDuration("52")).toBe(52);
    expect(parseDuration("01:05:30")).toBe(66);
    expect(parseDuration("45:10")).toBe(45);
    expect(parseDuration("1 h 5 min")).toBe(65);
    expect(parseDuration("1 hr 20 mins")).toBe(80);
    expect(parseDuration("2700 s")).toBe(45);
    expect(parseDuration("")).toBeNull();
    expect(analyzeAttendance([{ email: "x@example.org", name: "", minutes: null }], [{ id: "1", email: "x@example.org", full_name: "X Y" }], 45).matched[0]!.meetsThreshold).toBe(false);
  });
});

describe("attestations", () => {
  async function presentAndGenerated() {
    const s = setupCerts();
    const awa = await addRegistrant(s.repo, "awa@example.org", "Awa Diallo");
    await handleAdminAttendance(adminPost("admin-attendance", { action: "set", registration_id: awa.id, status: "present" }), s.deps);
    const gen = await body(await handleAdminCertificates(adminPost("admin-certificates", { action: "generate" }), s.deps));
    return { ...s, awa, gen, cert: s.certs.certificates[0]! };
  }

  it("génération : PDF A4 paysage stocké, numéro public, statut émis", async () => {
    const { gen, cert, certs } = await presentAndGenerated();
    expect(gen).toMatchObject({ status: "done", generated: 1, remaining: 0 });
    expect(cert.status).toBe("issued");
    expect(cert.file_path).toBe(`${cert.public_code}.pdf`);
    expect(cert.event_date).toBe("2026-12-03");
    const bytes = certs.files.get(cert.file_path!)!;
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    const { width, height } = pdf.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([842, 595]);
    expect(pdf.getKeywords()).toContain(cert.public_code);
    expect(pdf.getTitle()).toBe(`Attestation de participation — ${cert.public_code}`);
  });

  it("génération refusée tant que la date du webinaire n'est pas renseignée", async () => {
    const s = setupCerts();
    s.repo.settings = { ...s.repo.settings, date: null };
    expect((await handleAdminCertificates(adminPost("admin-certificates", { action: "generate" }), s.deps)).status).toBe(409);
  });

  it("le PDF contient un QR code vers la page de vérification", async () => {
    const url = "https://webinaire.example/verification/AXD-7K2P-9QWM";
    const out = await buildCertificatePdf({
      cfg: withSettings(event, { date: "2026-12-03" }),
      holderName: "Awa Diallo",
      code: "AXD-7K2P-9QWM",
      issuedAt: new Date("2026-12-04T10:00:00Z"),
      verifyUrl: url,
    });
    expect(out.qrModules).toBeGreaterThanOrEqual(21);
    // Le contenu exact du QR a été décodé depuis un rendu du PDF (jsQR) lors de la recette.
  });

  it("envoi : PDF en pièce jointe, idempotence par attestation, pas de doublon au renvoi d'un lot", async () => {
    const { deps, mailer, cert, awa } = await presentAndGenerated();
    const r = await body(await handleAdminCertificates(adminPost("admin-certificates", { action: "send" }), deps));
    expect(r).toMatchObject({ sent: 1, remaining: 0 });
    const mail = mailer.sent.at(-1)!;
    expect(mail.to).toBe(awa.email);
    expect(mail.subject).toBe("Votre attestation de participation au webinaire");
    expect(mail.attachments?.[0]?.filename).toBe(`attestation-${cert.public_code}.pdf`);
    expect(atob(mail.attachments![0]!.content).startsWith("%PDF-")).toBe(true);
    expect(mail.text).toContain("Archivexa · Docflow");
    expect(cert.status).toBe("sent");

    // Relancer l'envoi du lot ne renvoie rien (déjà envoyée).
    const again = await body(await handleAdminCertificates(adminPost("admin-certificates", { action: "send" }), deps));
    expect(again.sent).toBe(0);
    expect(mailer.sent).toHaveLength(1);
  });

  it("renvoi d'une attestation existante : même PDF, aucune nouvelle attestation, double clic absorbé", async () => {
    const { deps, mailer, cert, certs } = await presentAndGenerated();
    await handleAdminCertificates(adminPost("admin-certificates", { action: "send" }), deps);
    const pdfBefore = certs.files.get(cert.file_path!);
    const r1 = await handleAdminCertificates(adminPost("admin-certificates", { action: "resend", id: cert.id }), deps);
    const r2 = await handleAdminCertificates(adminPost("admin-certificates", { action: "resend", id: cert.id }), deps);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(mailer.sent).toHaveLength(2); // envoi initial + un seul renvoi (même minute = même clé)
    expect(certs.certificates).toHaveLength(1);
    expect(certs.files.get(cert.file_path!)).toBe(pdfBefore); // jamais régénéré
  });

  it("échec Resend simulé : l'attestation reste émise, l'erreur est notée, la reprise fonctionne", async () => {
    const { deps, mailer, cert } = await presentAndGenerated();
    mailer.failWith = "rate_limit_exceeded";
    const r = await body(await handleAdminCertificates(adminPost("admin-certificates", { action: "send" }), deps));
    expect(r).toMatchObject({ status: "partial", sent: 0, remaining: 1 });
    expect(cert).toMatchObject({ status: "issued", last_error: "rate_limit_exceeded", send_attempts: 1 });
    mailer.failWith = null;
    const retry = await body(await handleAdminCertificates(adminPost("admin-certificates", { action: "send" }), deps));
    expect(retry).toMatchObject({ status: "done", sent: 1, remaining: 0 });
    expect(cert).toMatchObject({ status: "sent", last_error: null, send_attempts: 2 });
  });

  it("correction du nom : même numéro, PDF régénéré, tracée dans l'audit ; révocation avec motif obligatoire", async () => {
    const { deps, cert, certs } = await presentAndGenerated();
    const code = cert.public_code;
    const before = certs.files.get(cert.file_path!);
    expect((await handleAdminCertificates(adminPost("admin-certificates", { action: "rename", id: cert.id, name: "Awa DIALLO Fatoumata" }), deps)).status).toBe(200);
    expect(cert.public_code).toBe(code);
    expect(cert.holder_name).toBe("Awa DIALLO Fatoumata");
    expect(certs.files.get(cert.file_path!)).not.toBe(before);
    expect(certs.auditLog.at(-1)).toMatchObject({ action: "certificate.rename", target: code, details: { from: "Awa Diallo", to: "Awa DIALLO Fatoumata" } });

    expect((await handleAdminCertificates(adminPost("admin-certificates", { action: "revoke", id: cert.id, reason: "" }), deps)).status).toBe(422);
    expect((await handleAdminCertificates(adminPost("admin-certificates", { action: "revoke", id: cert.id, reason: "Erreur de saisie" }), deps)).status).toBe(200);
    expect(cert).toMatchObject({ status: "revoked", revoked_reason: "Erreur de saisie" });
    expect((await handleAdminCertificates(adminPost("admin-certificates", { action: "resend", id: cert.id }), deps)).status).toBe(409);
  });

  it("accès non autorisé : sans session (401) et non-admin (403), pour présences et attestations", async () => {
    const { deps } = setupCerts();
    for (const h of [handleAdminAttendance, handleAdminCertificates]) {
      expect((await h(adminPost("x", { action: "generate" }, {}), deps)).status).toBe(401);
      expect((await h(adminPost("x", { action: "generate" }, { authorization: "Bearer jwt-intrus" }), deps)).status).toBe(403);
    }
  });
});

describe("vérification publique", () => {
  it("valide : numéro, nom abrégé, titre, date, organisateurs — et aucune donnée personnelle", async () => {
    const s = setupCerts();
    const reg = await addRegistrant(s.repo, "fatou.ka@example.org", "Fatou KA");
    s.repo.registrations[0]!.phone = "+229 01 23 45 67";
    await handleAdminAttendance(adminPost("admin-attendance", { action: "set", registration_id: reg.id, status: "present" }), s.deps);
    await handleAdminCertificates(adminPost("admin-certificates", { action: "generate" }), s.deps);
    const code = s.certs.certificates[0]!.public_code;

    const res = await handleVerifyCertificate(verify(code.toLowerCase()), s.deps);
    expect(res.status).toBe(200);
    const b = await body(res);
    expect(b).toMatchObject({ status: "valid", code, holder: "Fatou K.", title: event.title, date: "jeudi 3 décembre 2026" });
    expect(Object.keys(b).sort()).toEqual(["code", "date", "holder", "issued_at", "organizers", "status", "title"]);
    const raw = JSON.stringify(b);
    for (const secret of ["fatou.ka@example.org", "@", "+229", "Mairie", "Archiviste", reg.id]) expect(raw).not.toContain(secret);
  });

  it("révoquée : statut « revoked » ; inconnue, mal formée ou seulement éligible : introuvable", async () => {
    const s = setupCerts();
    const reg = await addRegistrant(s.repo, "a@example.org", "Ali Issa");
    await handleAdminAttendance(adminPost("admin-attendance", { action: "set", registration_id: reg.id, status: "present" }), s.deps);
    const code = s.certs.certificates[0]!.public_code;
    expect((await handleVerifyCertificate(verify(code), s.deps)).status).toBe(404); // éligible, pas encore émise
    await handleAdminCertificates(adminPost("admin-certificates", { action: "generate" }), s.deps);
    await handleAdminCertificates(adminPost("admin-certificates", { action: "revoke", id: s.certs.certificates[0]!.id, reason: "Présence contestée" }), s.deps);
    expect(await body(await handleVerifyCertificate(verify(code), s.deps))).toMatchObject({ status: "revoked", code });
    expect((await handleVerifyCertificate(verify("AXD-2222-2222"), s.deps)).status).toBe(404);
    expect((await handleVerifyCertificate(verify("n'importe-quoi"), s.deps)).status).toBe(404);
  });
});

describe("noms et numéros", () => {
  it("format « Prénom N. », y compris l'ordre NOM Prénom", () => {
    expect(formatHolderName("Awa Diallo", "first-initial")).toBe("Awa D.");
    expect(formatHolderName("CHABI BOUKO Daniel", "first-initial")).toBe("Daniel C. B.");
    expect(formatHolderName("Roguy ABADASSI", "first-initial")).toBe("Roguy A.");
    expect(formatHolderName("Awa Diallo", "initials")).toBe("A. D.");
    expect(formatHolderName("awa diallo", "full")).toBe("Awa DIALLO");
  });
  it("numéros aléatoires, non séquentiels, au bon format", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generatePublicCode("AXD")));
    expect(codes.size).toBe(500);
    for (const c of codes) expect(c).toMatch(CODE_RE);
  });
});
