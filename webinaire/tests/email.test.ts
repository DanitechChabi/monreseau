import { describe, expect, it } from "vitest";
import { confirmationEmail } from "../supabase/functions/_shared/email/templates.ts";
import { event, withSettings } from "../supabase/functions/_shared/event.ts";
import { ResendMailer } from "../supabase/functions/_shared/mailer.ts";
import { validateRegistration } from "../supabase/functions/_shared/validation.ts";

const render = (settings = {}) =>
  confirmationEmail({
    cfg: withSettings(event, settings),
    fullName: "Awa <b>Diallo</b>",
    confirmUrl: "https://projet.supabase.co/functions/v1/confirm?token=abc",
    siteUrl: "https://webinaire.example",
    ttlHours: 48,
  });

describe("e-mail de confirmation", () => {
  it("contient le nom, les organisateurs, le programme et le bouton", () => {
    const { subject, html, text } = render();
    expect(subject).toBe("Confirmation de votre inscription au webinaire");
    expect(html).toContain("Confirmer mon adresse");
    expect(html).toContain("ARCHIVEXA&nbsp;&nbsp;·&nbsp;&nbsp;DOCFLOW");
    expect(text).toContain("Archivexa (Bénin), Docflow (Niger) et RMBI (Bénin)");
    for (const name of ["Ousmane Abdou", "Roguy Abadassi", "Daniel Chabi Bouko"]) {
      expect(html).toContain(name);
      expect(text).toContain(name);
    }
    expect(text).toContain("https://projet.supabase.co/functions/v1/confirm?token=abc");
  });

  it("échappe les données saisies par le participant", () => {
    const { html } = render();
    expect(html).toContain("Awa &lt;b&gt;Diallo&lt;/b&gt;");
    expect(html).not.toContain("<b>Diallo</b>");
  });

  it("sans date ni lien : pas de bloc date, phrase d'attente pour le lien", () => {
    const { html, text } = render();
    expect(text).not.toContain("DATE ET HEURE");
    expect(html).not.toContain("Date et heure");
    expect(text).toContain("Le lien de connexion vous sera envoyé par e-mail avant le webinaire.");
    expect(text).not.toMatch(/Une question/);
  });

  it("avec date, lien et contact renseignés : tout apparaît", () => {
    const { text } = render({ date: "2026-12-03", time: "10:00", joinUrl: "https://meet.example/x", contactEmail: "contact@example.org" });
    expect(text).toContain("Date : Jeudi 3 décembre 2026");
    expect(text).toContain("Heure : 10 h 00 (heure du Bénin et du Niger)");
    expect(text).toContain("https://meet.example/x");
    expect(text).not.toContain("vous sera envoyé par e-mail avant");
    expect(text).toContain("contact@example.org");
  });
});

describe("client Resend", () => {
  it("transmet la clé d'idempotence et renvoie l'identifiant du message", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const mailer = new ResendMailer({ apiKey: "re_x", from: "W <w@example.org>", replyTo: "r@example.org" }, async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
    });
    const r = await mailer.send({ to: "a@example.org", subject: "S", html: "<p>h</p>", text: "t", idempotencyKey: "cle-1" });
    expect(r).toEqual({ ok: true, id: "msg_1" });
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("cle-1");
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ to: ["a@example.org"], reply_to: "r@example.org" });
  });

  it("échecs : non configuré, erreur API, réseau", async () => {
    const msg = { to: "a@example.org", subject: "S", html: "h", text: "t", idempotencyKey: "k" };
    expect(await new ResendMailer({ apiKey: null, from: null, replyTo: null }).send(msg)).toEqual({ ok: false, code: "not_configured" });
    const apiErr = new ResendMailer({ apiKey: "re_x", from: "w@example.org", replyTo: null }, async () =>
      new Response(JSON.stringify({ name: "validation_error", message: "domaine non vérifié" }), { status: 403 }),
    );
    expect(await apiErr.send(msg)).toEqual({ ok: false, code: "validation_error" });
    const netErr = new ResendMailer({ apiKey: "re_x", from: "w@example.org", replyTo: null }, async () => {
      throw new TypeError("fetch failed");
    });
    expect(await netErr.send(msg)).toEqual({ ok: false, code: "network_error" });
  });
});

describe("validation", () => {
  it("normalise l'e-mail entier en minuscules et nettoie les espaces", () => {
    const r = validateRegistration({
      full_name: "  Awa   Diallo ",
      email: " AWA@EXAMPLE.ORG ",
      organisation: "Mairie",
      job_title: "Archiviste",
      country: "NE",
      phone: "",
    });
    expect(r).toEqual({
      ok: true,
      value: {
        full_name: "Awa Diallo",
        email: "awa@example.org",
        organisation: "Mairie",
        job_title: "Archiviste",
        country: "NE",
        phone: null,
        marketing_consent: false,
      },
    });
  });

  it("refuse pays inconnu, téléphone invalide, champs manquants", () => {
    const r = validateRegistration({ full_name: "Awa", email: "x", country: "FR", phone: "abc" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["country", "email", "full_name", "job_title", "organisation", "phone"]);
  });
});
