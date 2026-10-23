/**
 * Modèles d'e-mails (HTML responsive + texte brut).
 *
 * Pour modifier un texte : changer les chaînes ci-dessous. Les couleurs
 * reprennent celles du site. Toute donnée saisie par un participant passe par
 * `esc()` avant d'entrer dans le HTML.
 */
import { formatEventDate, formatEventTimes } from "../datetime.ts";
import { type EventConfig, organizerNames } from "../event.ts";

const C = {
  forest: "#073B32",
  emeraude: "#10B981",
  paper: "#F8FAF7",
  ink: "#111827",
  muted: "#4B5563",
  line: "#DDE5DF",
};
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Arial, Helvetica, sans-serif";

export type RenderedEmail = { subject: string; html: string; text: string };

export function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ---------- Blocs communs ---------- */

function layout(cfg: EventConfig, opts: { preheader: string; body: string; footer: string }): string {
  const orgs = cfg.organizers.map((o) => esc(o.name)).join(" &middot; ");
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(cfg.title)}</title>
<style>
  @media (max-width: 620px) {
    .container { width: 100% !important; }
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .btn a { display: block !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid ${C.line};border-radius:12px;overflow:hidden;">
      <tr><td class="px" style="background:${C.forest};padding:24px 32px;">
        <p style="margin:0;font-family:${SERIF};font-size:18px;font-weight:bold;color:#FFFFFF;">${orgs}</p>
        <p style="margin:6px 0 0;font-family:${SANS};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${C.emeraude};">Webinaire gratuit &middot; ${esc(cfg.tagline)}</p>
      </td></tr>
      <tr><td class="px" style="padding:32px;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink};">
        ${opts.body}
      </td></tr>
      <tr><td class="px" style="padding:20px 32px;border-top:1px solid ${C.line};font-family:${SANS};font-size:13px;line-height:1.5;color:${C.muted};">
        ${opts.footer}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" class="btn" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr><td style="border-radius:999px;background:${C.forest};">
    <a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:999px;">${esc(label)}</a>
  </td></tr>
</table>`;
}

const h2 = (t: string) =>
  `<h2 style="margin:28px 0 8px;font-family:${SERIF};font-size:20px;line-height:1.3;color:${C.forest};">${esc(t)}</h2>`;
const p = (html: string) => `<p style="margin:0 0 12px;">${html}</p>`;

type Section = { html: string; text: string };

/** Date et heure : uniquement si renseignées. */
function whenSection(cfg: EventConfig): Section | null {
  const date = formatEventDate(cfg);
  const times = formatEventTimes(cfg);
  if (!date && !times) return null;
  const lines = [date && `Date : ${date}`, times && `Heure : ${times}`].filter(Boolean) as string[];
  return {
    html: h2("Date et heure") + lines.map((l) => p(esc(l))).join(""),
    text: `DATE ET HEURE\n${lines.join("\n")}`,
  };
}

function programmeSection(cfg: EventConfig): Section {
  const speakers = new Map(cfg.speakers.map((s) => [s.id, s.name]));
  const items = cfg.programme.map((item) =>
    item.kind === "talk"
      ? { strong: speakers.get(item.speakerId) ?? "", rest: item.title }
      : { strong: item.title, rest: "" },
  );
  const html =
    h2("Programme") +
    `<ol style="margin:0;padding-left:22px;">` +
    items
      .map(
        (i) =>
          `<li style="margin:0 0 8px;"><strong>${esc(i.strong)}</strong>${i.rest ? ` &mdash; ${esc(i.rest)}` : ""}</li>`,
      )
      .join("") +
    `</ol>` +
    p(`<span style="color:${C.muted};">Des exemples du Bénin et du Niger seront présentés.</span>`);
  const text =
    "PROGRAMME\n" +
    items.map((i, n) => `${n + 1}. ${i.strong}${i.rest ? ` — ${i.rest}` : ""}`).join("\n") +
    "\nDes exemples du Bénin et du Niger seront présentés.";
  return { html, text };
}

/** Lien de participation s'il est renseigné, sinon la phrase d'attente. */
function joinSection(cfg: EventConfig): Section {
  if (cfg.joinUrl) {
    return {
      html: h2("Lien de participation") + p(`<a href="${esc(cfg.joinUrl)}" style="color:${C.forest};font-weight:bold;">${esc(cfg.joinUrl)}</a>`),
      text: `LIEN DE PARTICIPATION\n${cfg.joinUrl}`,
    };
  }
  const s = "Le lien de connexion vous sera envoyé par e-mail avant le webinaire.";
  return { html: p(esc(s)), text: s };
}

function contactSection(cfg: EventConfig): Section | null {
  if (!cfg.contactEmail) return null;
  return {
    html: p(`Une question ? Écrivez-nous à <a href="mailto:${esc(cfg.contactEmail)}" style="color:${C.forest};">${esc(cfg.contactEmail)}</a>.`),
    text: `Une question ? Écrivez-nous à ${cfg.contactEmail}.`,
  };
}

function footer(cfg: EventConfig, siteUrl: string, reason: string): Section {
  const privacy = `${siteUrl}/confidentialite`;
  return {
    html: `${esc(reason)}<br>Organisé par ${esc(organizerNames(cfg))} &middot; <a href="${esc(privacy)}" style="color:${C.muted};">Confidentialité</a>`,
    text: `${reason}\nOrganisé par ${organizerNames(cfg)} · Confidentialité : ${privacy}`,
  };
}

const join = (parts: (Section | null)[]) => parts.filter(Boolean) as Section[];

/* ---------- E-mail de confirmation d'inscription ---------- */

export function confirmationEmail(args: {
  cfg: EventConfig;
  fullName: string;
  confirmUrl: string;
  siteUrl: string;
  ttlHours: number;
}): RenderedEmail {
  const { cfg, fullName, confirmUrl, siteUrl, ttlHours } = args;
  const subject = "Confirmation de votre inscription au webinaire";
  const intro = `Merci pour votre inscription au webinaire gratuit « ${cfg.title} », organisé par ${organizerNames(cfg)}.`;
  const ask = "Pour finaliser votre inscription, merci de confirmer votre adresse e-mail :";
  const validity = `Ce lien est valable ${ttlHours} heures.`;
  const sections = join([whenSection(cfg), programmeSection(cfg), joinSection(cfg), contactSection(cfg)]);
  const foot = footer(
    cfg,
    siteUrl,
    "Vous recevez cet e-mail car cette adresse a été utilisée pour s'inscrire au webinaire. Si ce n'est pas vous, ignorez ce message : sans confirmation, l'inscription ne sera pas validée.",
  );

  const html = layout(cfg, {
    preheader: "Confirmez votre adresse pour finaliser votre inscription.",
    body:
      `<h1 style="margin:0 0 16px;font-family:${SERIF};font-size:26px;line-height:1.25;color:${C.forest};">Bonjour ${esc(fullName)},</h1>` +
      p(esc(intro)) +
      p(esc(ask)) +
      button(confirmUrl, "Confirmer mon adresse") +
      p(`<span style="font-size:13px;color:${C.muted};">${esc(validity)} Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${esc(confirmUrl)}" style="color:${C.muted};word-break:break-all;">${esc(confirmUrl)}</a></span>`) +
      sections.map((s) => s.html).join(""),
    footer: foot.html,
  });

  const text = [
    `Bonjour ${fullName},`,
    intro,
    `${ask}\n${confirmUrl}\n${validity}`,
    ...sections.map((s) => s.text),
    "—",
    foot.text,
  ].join("\n\n");

  return { subject, html, text };
}

/* ---------- Informations pratiques (date confirmée, lien) ---------- */

export function eventDetailsEmail(args: { cfg: EventConfig; fullName: string; siteUrl: string }): RenderedEmail {
  const { cfg, fullName, siteUrl } = args;
  const subject = "Webinaire : date, heure et informations de connexion";
  const intro = `Votre inscription au webinaire « ${cfg.title} » est confirmée. Voici les informations pratiques.`;
  const sections = join([whenSection(cfg), joinSection(cfg), programmeSection(cfg), contactSection(cfg)]);
  const foot = footer(cfg, siteUrl, "Vous recevez cet e-mail car vous êtes inscrit(e) à ce webinaire.");

  const html = layout(cfg, {
    preheader: "Date, heure et informations de connexion du webinaire.",
    body:
      `<h1 style="margin:0 0 16px;font-family:${SERIF};font-size:26px;line-height:1.25;color:${C.forest};">Bonjour ${esc(fullName)},</h1>` +
      p(esc(intro)) +
      sections.map((s) => s.html).join(""),
    footer: foot.html,
  });
  const text = [`Bonjour ${fullName},`, intro, ...sections.map((s) => s.text), "—", foot.text].join("\n\n");
  return { subject, html, text };
}

/* ---------- Lien de connexion à l'administration ---------- */

export function adminLoginEmail(args: { cfg: EventConfig; loginUrl: string; siteUrl: string }): RenderedEmail {
  const { cfg, loginUrl, siteUrl } = args;
  const subject = "Votre lien de connexion à l'administration du webinaire";
  const intro = "Voici votre lien de connexion à l'espace d'administration des inscriptions. Il est à usage unique et expire rapidement.";
  const foot = footer(cfg, siteUrl, "Si vous n'avez pas demandé ce lien, ignorez ce message.");
  const html = layout(cfg, {
    preheader: "Lien de connexion à l'administration.",
    body:
      `<h1 style="margin:0 0 16px;font-family:${SERIF};font-size:26px;line-height:1.25;color:${C.forest};">Connexion à l'administration</h1>` +
      p(esc(intro)) +
      button(loginUrl, "Se connecter"),
    footer: foot.html,
  });
  const text = [intro, loginUrl, "—", foot.text].join("\n\n");
  return { subject, html, text };
}
