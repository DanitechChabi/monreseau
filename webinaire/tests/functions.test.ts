import { describe, expect, it } from "vitest";
import { sha256Hex } from "../supabase/functions/_shared/crypto.ts";
import { handleAdminAnnounce, handleAdminLogin, handleAdminResend } from "../supabase/functions/_shared/handlers/admin.ts";
import { handleConfirm } from "../supabase/functions/_shared/handlers/confirm.ts";
import { handleRegister } from "../supabase/functions/_shared/handlers/register.ts";
import { handleResendConfirmation, NEUTRAL_MESSAGE } from "../supabase/functions/_shared/handlers/resend-confirmation.ts";
import { post, setup, tokenFrom, validRegistration } from "./fakes.ts";

const body = async (r: Response) => (await r.json()) as Record<string, unknown>;
const confirmReq = (token: string) => new Request(`https://projet.supabase.co/functions/v1/confirm?token=${token}`);

describe("register", () => {
  it("nouvelle inscription : ligne créée, e-mail envoyé, seul le hash du jeton est stocké", async () => {
    const { repo, mailer, deps } = setup();
    const res = await handleRegister(post("register", validRegistration), deps);
    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ status: "registered_email_sent" });

    expect(repo.registrations).toHaveLength(1);
    expect(repo.registrations[0]).toMatchObject({ email: "awa.diallo@example.org", status: "pending_confirmation", marketing_consent: false });
    expect(mailer.sent).toHaveLength(1);
    const mail = mailer.sent[0]!;
    expect(mail.to).toBe("awa.diallo@example.org");
    expect(mail.subject).toBe("Confirmation de votre inscription au webinaire");
    const token = tokenFrom(mail);
    expect(repo.tokens).toHaveLength(1);
    expect(repo.tokens[0]!.token_hash).toBe(await sha256Hex(token));
    expect(JSON.stringify(repo.tokens)).not.toContain(token);
    expect(repo.tokens[0]!.expires_at.getTime() - deps.now!().getTime()).toBe(48 * 3600_000);
    expect(repo.logs).toEqual([expect.objectContaining({ type: "confirmation", status: "sent" })]);
    expect(JSON.stringify(repo.logs)).not.toContain("@");
  });

  it("adresse invalide : 422 avec message en français, rien d'enregistré", async () => {
    const { repo, mailer, deps } = setup();
    const res = await handleRegister(post("register", { ...validRegistration, email: "awa@" }), deps);
    expect(res.status).toBe(422);
    const b = await body(res);
    expect(b.status).toBe("validation_error");
    expect((b.errors as Record<string, string>).email).toMatch(/ne semble pas valide/);
    expect(repo.registrations).toHaveLength(0);
    expect(mailer.sent).toHaveLength(0);
  });

  it("adresse déjà inscrite : pas de nouvelle ligne, pas de nouvel e-mail", async () => {
    const { repo, mailer, deps } = setup();
    await handleRegister(post("register", validRegistration), deps);
    const res = await handleRegister(post("register", { ...validRegistration, email: "AWA.DIALLO@example.org" }), deps);
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ status: "already_registered", confirmed: false });
    expect(repo.registrations).toHaveLength(1);
    expect(mailer.sent).toHaveLength(1);
  });

  it("double clic (requêtes simultanées) : une seule inscription, un seul e-mail", async () => {
    const { repo, mailer, deps } = setup();
    const [a, b] = await Promise.all([
      handleRegister(post("register", validRegistration), deps),
      handleRegister(post("register", validRegistration), deps),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(repo.registrations).toHaveLength(1);
    expect(mailer.sent).toHaveLength(1);
  });

  it("échec Resend simulé : inscription conservée, statut « en attente », renvoi possible", async () => {
    const { repo, mailer, deps } = setup();
    mailer.failWith = "rate_limit_exceeded";
    const res = await handleRegister(post("register", validRegistration), deps);
    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ status: "registered_email_pending" });
    expect(repo.registrations).toHaveLength(1);
    expect(repo.logs).toEqual([expect.objectContaining({ status: "failed", error_code: "rate_limit_exceeded" })]);

    // Le participant redemande l'envoi immédiatement (pas de délai imposé après un échec).
    mailer.failWith = null;
    const again = await handleResendConfirmation(post("resend-confirmation", { email: "awa.diallo@example.org" }), deps);
    expect(again.status).toBe(200);
    expect(mailer.sent).toHaveLength(1);
    expect(repo.logs.at(-1)).toMatchObject({ status: "sent" });
  });

  it("pot de miel rempli : rien n'est enregistré ni envoyé", async () => {
    const { repo, mailer, deps } = setup();
    const res = await handleRegister(post("register", { ...validRegistration, website: "https://spam.example" }), deps);
    expect(res.status).toBe(202);
    expect(repo.registrations).toHaveLength(0);
    expect(mailer.sent).toHaveLength(0);
  });

  it("limite par IP : au-delà du plafond, 429", async () => {
    const { deps } = setup({ registerMaxPerIpPerHour: 2 });
    const codes = [];
    for (let i = 0; i < 3; i++)
      codes.push((await handleRegister(post("register", { ...validRegistration, email: `p${i}@example.org` }), deps)).status);
    expect(codes).toEqual([201, 201, 429]);
  });

  it("refuse les méthodes autres que POST et répond au pré-vol CORS", async () => {
    const { deps } = setup();
    const opt = await handleRegister(new Request("https://x/register", { method: "OPTIONS", headers: { origin: "https://webinaire.example" } }), deps);
    expect(opt.status).toBe(204);
    expect(opt.headers.get("access-control-allow-origin")).toBe("https://webinaire.example");
    expect((await handleRegister(new Request("https://x/register"), deps)).status).toBe(405);
  });
});

describe("resend-confirmation", () => {
  it("renvoi : nouveau jeton, l'ancien lien devient invalide", async () => {
    const { mailer, deps, advance } = setup();
    await handleRegister(post("register", validRegistration), deps);
    const oldToken = tokenFrom(mailer.sent[0]!);
    advance(6);
    const res = await handleResendConfirmation(post("resend-confirmation", { email: " Awa.Diallo@example.org" }), deps);
    expect(await body(res)).toEqual({ status: "neutral", message: NEUTRAL_MESSAGE });
    expect(mailer.sent).toHaveLength(2);
    const newToken = tokenFrom(mailer.sent[1]!);
    expect(newToken).not.toBe(oldToken);

    const oldRes = await handleConfirm(confirmReq(oldToken), deps);
    expect(oldRes.headers.get("location")).toBe("https://webinaire.example/confirmation?etat=invalide");
    const newRes = await handleConfirm(confirmReq(newToken), deps);
    expect(newRes.headers.get("location")).toBe("https://webinaire.example/confirmation?etat=ok");
  });

  it("réponse neutre pour une adresse inconnue (aucun e-mail envoyé)", async () => {
    const { mailer, deps } = setup();
    const res = await handleResendConfirmation(post("resend-confirmation", { email: "inconnu@example.org" }), deps);
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ status: "neutral", message: NEUTRAL_MESSAGE });
    expect(mailer.sent).toHaveLength(0);
  });

  it("limitation : délai minimal de 5 min, puis plafond quotidien par adresse", async () => {
    const { mailer, deps, advance } = setup({ resendMaxPerEmailPerDay: 2 });
    await handleRegister(post("register", validRegistration), deps);
    const ask = () => handleResendConfirmation(post("resend-confirmation", { email: "awa.diallo@example.org" }), deps);

    const tooSoon = await ask(); // juste après l'inscription
    expect(tooSoon.status).toBe(429);
    expect(await body(tooSoon)).toEqual({ status: "cooldown", retry_after_minutes: 5 });

    advance(5);
    expect((await ask()).status).toBe(200);
    advance(5);
    expect((await ask()).status).toBe(200);
    advance(5);
    expect((await ask()).status).toBe(429); // 3e demande du jour > plafond de 2
    expect(mailer.sent).toHaveLength(3); // inscription + 2 renvois
  });

  it("le délai s'applique aussi aux adresses non inscrites (rien n'est révélé)", async () => {
    const { deps } = setup();
    const ask = () => handleResendConfirmation(post("resend-confirmation", { email: "inconnu@example.org" }), deps);
    expect((await ask()).status).toBe(200);
    expect((await ask()).status).toBe(429);
  });

  it("plafond par IP", async () => {
    const { deps } = setup({ resendMaxPerIpPerHour: 2 });
    const codes = [];
    for (let i = 0; i < 3; i++)
      codes.push((await handleResendConfirmation(post("resend-confirmation", { email: `x${i}@example.org` }), deps)).status);
    expect(codes).toEqual([200, 200, 429]);
  });

  it("aucun envoi pour une inscription déjà confirmée", async () => {
    const { mailer, deps, advance } = setup();
    await handleRegister(post("register", validRegistration), deps);
    await handleConfirm(confirmReq(tokenFrom(mailer.sent[0]!)), deps);
    advance(10);
    await handleResendConfirmation(post("resend-confirmation", { email: "awa.diallo@example.org" }), deps);
    expect(mailer.sent).toHaveLength(1);
  });
});

describe("confirm", () => {
  it("jeton valide → ok ; réutilisé → invalide", async () => {
    const { repo, mailer, deps } = setup();
    await handleRegister(post("register", validRegistration), deps);
    const token = tokenFrom(mailer.sent[0]!);
    const first = await handleConfirm(confirmReq(token), deps);
    expect(first.status).toBe(303);
    expect(first.headers.get("location")).toBe("https://webinaire.example/confirmation?etat=ok");
    expect(repo.registrations[0]!.status).toBe("confirmed");
    const reuse = await handleConfirm(confirmReq(token), deps);
    expect(reuse.headers.get("location")).toBe("https://webinaire.example/confirmation?etat=invalide");
  });

  it("jeton expiré (> 48 h) → expire, l'inscription reste en attente", async () => {
    const { repo, mailer, deps, advance } = setup();
    await handleRegister(post("register", validRegistration), deps);
    advance(48 * 60 + 1);
    const res = await handleConfirm(confirmReq(tokenFrom(mailer.sent[0]!)), deps);
    expect(res.headers.get("location")).toBe("https://webinaire.example/confirmation?etat=expire");
    expect(repo.registrations[0]!.status).toBe("pending_confirmation");
  });

  it("jeton mal formé ou inconnu → invalide ; HEAD ne consomme pas le jeton", async () => {
    const { repo, mailer, deps } = setup();
    expect((await handleConfirm(confirmReq("abc"), deps)).headers.get("location")).toMatch(/etat=invalide$/);
    expect((await handleConfirm(confirmReq("A".repeat(43)), deps)).headers.get("location")).toMatch(/etat=invalide$/);

    await handleRegister(post("register", validRegistration), deps);
    const token = tokenFrom(mailer.sent[0]!);
    const head = await handleConfirm(new Request(`https://x/confirm?token=${token}`, { method: "HEAD" }), deps);
    expect(head.status).toBe(200);
    expect(repo.registrations[0]!.status).toBe("pending_confirmation");
  });
});

describe("administration", () => {
  it("admin-resend : refusé sans session (401) et pour un non-admin (403)", async () => {
    const { repo, deps } = setup();
    await handleRegister(post("register", validRegistration), deps);
    const id = repo.registrations[0]!.id;
    expect((await handleAdminResend(post("admin-resend", { registration_id: id }), deps)).status).toBe(401);
    const res = await handleAdminResend(post("admin-resend", { registration_id: id }, { authorization: "Bearer jwt-intrus" }), deps);
    expect(res.status).toBe(403);
    expect((await handleAdminResend(post("admin-resend", { registration_id: id }, { authorization: "Bearer jeton-bidon" }), deps)).status).toBe(401);
  });

  it("admin-resend : renvoie la confirmation à un inscrit en attente", async () => {
    const { repo, mailer, deps } = setup();
    await handleRegister(post("register", validRegistration), deps);
    const res = await handleAdminResend(
      post("admin-resend", { registration_id: repo.registrations[0]!.id }, { authorization: "Bearer jwt-admin" }),
      deps,
    );
    expect(await body(res)).toEqual({ status: "email_sent", type: "confirmation" });
    expect(mailer.sent).toHaveLength(2);
  });

  it("admin-resend : signale l'échec Resend sans le masquer", async () => {
    const { repo, mailer, deps } = setup();
    await handleRegister(post("register", validRegistration), deps);
    mailer.failWith = "validation_error";
    const res = await handleAdminResend(
      post("admin-resend", { registration_id: repo.registrations[0]!.id }, { authorization: "Bearer jwt-admin" }),
      deps,
    );
    expect(res.status).toBe(502);
    expect(await body(res)).toMatchObject({ status: "email_failed", error_code: "validation_error" });
  });

  it("admin-login : lien envoyé aux seuls administrateurs, réponse identique pour tous", async () => {
    const { repo, mailer, deps } = setup();
    const a = await handleAdminLogin(post("admin-login", { email: "Admin@Archivexa.example" }), deps);
    const b = await handleAdminLogin(post("admin-login", { email: "intrus@example.org" }), deps);
    expect(await body(a)).toEqual(await body(b));
    expect(repo.magicLinks).toHaveLength(1);
    expect(mailer.sent.map((m) => m.to)).toEqual(["admin@archivexa.example"]);
    expect(mailer.sent[0]!.html).toContain("redirect_to=https%3A%2F%2Fwebinaire.example%2Fadmin");
  });

  it("admin-announce : refusé au non-admin, exige une date, n'envoie qu'une fois par version", async () => {
    const { repo, mailer, deps } = setup();
    await handleRegister(post("register", validRegistration), deps);
    await handleConfirm(confirmReq(tokenFrom(mailer.sent[0]!)), deps);
    const auth = { authorization: "Bearer jwt-admin" };

    expect((await handleAdminAnnounce(post("admin-announce", {}, { authorization: "Bearer jwt-intrus" }), deps)).status).toBe(403);
    expect((await handleAdminAnnounce(post("admin-announce", {}, auth), deps)).status).toBe(409);

    repo.settings = { ...repo.settings, date: "2026-12-03", time: "10:00" };
    expect(await body(await handleAdminAnnounce(post("admin-announce", { dry_run: true }, auth), deps))).toMatchObject({
      status: "preview",
      count: 1,
    });
    const sent = await body(await handleAdminAnnounce(post("admin-announce", {}, auth), deps));
    expect(sent).toMatchObject({ status: "done", sent: 1, failed: 0 });
    const details = mailer.sent.at(-1)!;
    expect(details.text).toContain("jeudi 3 décembre 2026");
    expect(details.text).toContain("10 h 00 (heure du Bénin et du Niger)");
    expect(details.text).toContain("Le lien de connexion vous sera envoyé par e-mail avant le webinaire.");

    // Deuxième clic : rien de nouveau. Nouveau lien de participation : nouvel envoi.
    expect(await body(await handleAdminAnnounce(post("admin-announce", {}, auth), deps))).toMatchObject({ sent: 0 });
    repo.settings = { ...repo.settings, joinUrl: "https://meet.example/webinaire" };
    expect(await body(await handleAdminAnnounce(post("admin-announce", {}, auth), deps))).toMatchObject({ sent: 1 });
    expect(mailer.sent.at(-1)!.text).toContain("https://meet.example/webinaire");
  });
});
