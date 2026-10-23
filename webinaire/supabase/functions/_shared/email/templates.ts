/**
 * Modèles d'e-mails (HTML + texte brut).
 *
 * Charte volontairement sobre : fond blanc, texte anthracite, un seul accent
 * (vert profond) pour le bouton et le filet supérieur. Mise en page en tableaux
 * pour la compatibilité avec les messageries (Outlook, Gmail, Apple Mail).
 *
 * Pour modifier un texte : changer les chaînes ci-dessous. Toute donnée saisie
 * par un participant passe par `esc()` avant d'entrer dans le HTML.
 */
import { formatEventDate, formatEventTimes } from "../datetime.ts";
import { type EventConfig, organizerNames } from "../event.ts";

const C = {
  page: "#F4F5F4",
  card: "#FFFFFF",
  text: "#1F2933",
  muted: "#5F6B76",
  faint: "#8A949C",
  rule: "#E3E7E4",
  accent: "#073B32",
};
const FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export type RenderedEmail = { subject: string; html: string; text: string };

export function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ---------------------------------------------------------------------------
 * Blocs communs
 * ------------------------------------------------------------------------- */

/** « Archivexa (Bénin), Docflow (Niger) et RMBI (Bénin) » */
function organizersWithCountry(cfg: EventConfig): string {
  const items = cfg.organizers.map((o) => `${o.name} (${o.country})`);
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}` : (items[0] ?? "");
}

function layout(cfg: EventConfig, o: { preheader: string; title: string; body: string; footer: string }): string {
  const masthead = cfg.organizers.map((x) => esc(x.name.toUpperCase())).join("&nbsp;&nbsp;·&nbsp;&nbsp;");
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${esc(o.title)}</title>
<style>
  body { margin: 0; padding: 0; }
  a { color: ${C.accent}; }
  @media (max-width: 620px) {
    .container { width: 100% !important; }
    .px { padding-left: 24px !important; padding-right: 24px !important; }
    .h1 { font-size: 22px !important; }
    .btn a { display: block !important; text-align: center !important; }
    .meta td { display: block !important; width: 100% !important; padding: 2px 0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(o.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
  <tr><td align="center" style="padding:32px 12px;">

    <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
      <tr><td class="px" style="padding:0 8px 16px;font-family:${FONT};font-size:11px;letter-spacing:2px;color:${C.muted};">
        ${masthead}
      </td></tr>
    </table>

    <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${C.card};border:1px solid ${C.rule};border-top:3px solid ${C.accent};">
      <tr><td class="px" style="padding:40px 48px 8px;font-family:${FONT};">
        <p style="margin:0 0 12px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${C.muted};">Webinaire gratuit&nbsp;·&nbsp;${esc(cfg.tagline)}</p>
        <h1 class="h1" style="margin:0;font-size:24px;line-height:1.3;font-weight:700;color:${C.text};">${esc(o.title)}</h1>
      </td></tr>
      <tr><td class="px" style="padding:24px 48px 40px;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.text};">
        ${o.body}
      </td></tr>
    </table>

    <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
      <tr><td class="px" style="padding:20px 48px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint};">
        ${o.footer}
      </td></tr>
    </table>

  </td></tr>
</table>
</body>
</html>`;
}

const p = (html: string, extra = "") => `<p style="margin:0 0 16px;${extra}">${html}</p>`;

function button(href: string, label: string): string {
  return `<table role="presentation" class="btn" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr><td bgcolor="${C.accent}" style="background:${C.accent};border-radius:4px;">
    <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:#FFFFFF;text-decoration:none;border-radius:4px;">${esc(label)}</a>
  </td></tr>
</table>`;
}

function sectionTitle(t: string): string {
  return `<p style="margin:32px 0 12px;padding-top:24px;border-top:1px solid ${C.rule};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.muted};">${esc(t)}</p>`;
}

/** Tableau « libellé / valeur » (informations pratiques). */
function metaTable(rows: [string, string][]): string {
  return `<table role="presentation" class="meta" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${FONT};font-size:15px;line-height:1.5;">
${rows
  .map(
    ([k, v]) => `  <tr>
    <td width="150" valign="top" style="padding:6px 16px 6px 0;color:${C.muted};">${esc(k)}</td>
    <td valign="top" style="padding:6px 0;color:${C.text};">${v}</td>
  </tr>`,
  )
  .join("\n")}
</table>`;
}

type Block = { html: string; text: string };

/** Informations pratiques. La date, l'heure et le lien n'apparaissent que s'ils sont renseignés. */
function practical(cfg: EventConfig): Block {
  const date = formatEventDate(cfg);
  const times = formatEventTimes(cfg);
  const rows: [string, string][] = [["Thème", esc(cfg.title)]];
  const lines = [`Thème : ${cfg.title}`];
  if (date) {
    const d = date.charAt(0).toUpperCase() + date.slice(1);
    rows.push(["Date", esc(d)]);
    lines.push(`Date : ${d}`);
  }
  if (times) {
    rows.push(["Heure", esc(times)]);
    lines.push(`Heure : ${times}`);
  }
  rows.push(["Format", "En ligne, gratuit"]);
  lines.push("Format : en ligne, gratuit");
  rows.push(["Organisation", esc(organizersWithCountry(cfg))]);
  lines.push(`Organisation : ${organizersWithCountry(cfg)}`);
  if (cfg.joinUrl) {
    rows.push(["Connexion", `<a href="${esc(cfg.joinUrl)}" style="color:${C.accent};font-weight:600;">${esc(cfg.joinUrl)}</a>`]);
    lines.push(`Lien de connexion : ${cfg.joinUrl}`);
  }
  const pending = !cfg.joinUrl ? "Le lien de connexion vous sera envoyé par e-mail avant le webinaire." : "";
  return {
    html:
      sectionTitle("Informations pratiques") +
      metaTable(rows) +
      (pending ? p(esc(pending), `margin:16px 0 0;color:${C.muted};`) : ""),
    text: ["INFORMATIONS PRATIQUES", ...lines, ...(pending ? ["", pending] : [])].join("\n"),
  };
}

function programme(cfg: EventConfig): Block {
  const speakers = new Map(cfg.speakers.map((s) => [s.id, s.name]));
  const talks = cfg.programme.map((item, i) =>
    item.kind === "talk"
      ? { n: String(i + 1), title: item.title, who: speakers.get(item.speakerId) ?? "" }
      : { n: "", title: item.title, who: "" },
  );
  const html =
    sectionTitle("Programme") +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${FONT};font-size:15px;line-height:1.5;">
${talks
  .map(
    (t) => `  <tr>
    <td width="28" valign="top" style="padding:8px 0;color:${C.muted};font-weight:600;">${t.n ? `${t.n}.` : "—"}</td>
    <td valign="top" style="padding:8px 0;color:${C.text};"><strong style="font-weight:600;">${esc(t.title)}</strong>${
      t.who ? `<br><span style="color:${C.muted};">${esc(t.who)}</span>` : ""
    }</td>
  </tr>`,
  )
  .join("\n")}
</table>` +
    p("Chaque intervention s'appuie sur des exemples concrets issus du Bénin et du Niger.", `margin:12px 0 0;color:${C.muted};`);
  const text = [
    "PROGRAMME",
    ...talks.map((t) => (t.n ? `${t.n}. ${t.title} — ${t.who}` : `— ${t.title}`)),
    "Chaque intervention s'appuie sur des exemples concrets issus du Bénin et du Niger.",
  ].join("\n");
  return { html, text };
}

function signature(cfg: EventConfig): Block {
  const team = cfg.organizers.map((o) => o.name).join(" · ");
  const contact = cfg.contactEmail
    ? p(
        `Pour toute question, vous pouvez nous écrire à <a href="mailto:${esc(cfg.contactEmail)}" style="color:${C.accent};">${esc(cfg.contactEmail)}</a>.`,
        "margin:24px 0 16px;",
      )
    : "";
  return {
    html: `${contact}${p("Bien cordialement,", cfg.contactEmail ? "" : "margin:24px 0 16px;")}${p(
      `<strong style="font-weight:600;">L'équipe d'organisation</strong><br><span style="color:${C.muted};">${esc(team)}</span>`,
      "margin:0;",
    )}`,
    text: [
      ...(cfg.contactEmail ? [`Pour toute question, vous pouvez nous écrire à ${cfg.contactEmail}.`, ""] : []),
      "Bien cordialement,",
      "",
      "L'équipe d'organisation",
      team,
    ].join("\n"),
  };
}

function footer(siteUrl: string, reason: string): Block {
  const privacy = `${siteUrl}/confidentialite`;
  return {
    html: `${esc(reason)}<br>Vos données sont traitées uniquement pour l'organisation de ce webinaire&nbsp;: <a href="${esc(privacy)}" style="color:${C.faint};">politique de confidentialité</a>.`,
    text: `${reason}\nVos données sont traitées uniquement pour l'organisation de ce webinaire : ${privacy}`,
  };
}

/* ---------------------------------------------------------------------------
 * E-mail de confirmation d'inscription
 * ------------------------------------------------------------------------- */

export function confirmationEmail(args: {
  cfg: EventConfig;
  fullName: string;
  confirmUrl: string;
  siteUrl: string;
  ttlHours: number;
}): RenderedEmail {
  const { cfg, fullName, confirmUrl, siteUrl, ttlHours } = args;
  const subject = "Confirmation de votre inscription au webinaire";
  const title = "Confirmez votre inscription";
  const intro = `Nous vous remercions de votre inscription au webinaire « ${cfg.title} », organisé par ${organizersWithCountry(cfg)}.`;
  const ask =
    "Afin de valider votre participation, nous vous invitons à confirmer votre adresse électronique en cliquant sur le bouton ci-dessous.";
  const validity = `Ce lien est personnel et valable ${ttlHours} heures.`;
  const closing = "Nous nous réjouissons de vous compter parmi les participants.";
  const info = practical(cfg);
  const prog = programme(cfg);
  const sign = signature(cfg);
  const foot = footer(
    siteUrl,
    "Vous recevez ce message parce que cette adresse a été utilisée pour s'inscrire au webinaire. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message : sans confirmation, l'inscription ne sera pas validée.",
  );

  const html = layout(cfg, {
    preheader: "Une dernière étape : confirmez votre adresse pour valider votre inscription.",
    title,
    body:
      p(`Bonjour ${esc(fullName)},`) +
      p(esc(intro)) +
      p(esc(ask)) +
      button(confirmUrl, "Confirmer mon adresse") +
      p(
        `${esc(validity)} Si le bouton ne fonctionne pas, copiez l'adresse suivante dans votre navigateur&nbsp;:<br><a href="${esc(confirmUrl)}" style="color:${C.muted};word-break:break-all;">${esc(confirmUrl)}</a>`,
        `font-size:13px;line-height:1.55;color:${C.muted};`,
      ) +
      info.html +
      prog.html +
      `<div style="margin-top:32px;padding-top:24px;border-top:1px solid ${C.rule};">${p(esc(closing))}${sign.html}</div>`,
    footer: foot.html,
  });

  const text = [
    `Bonjour ${fullName},`,
    intro,
    ask,
    `Confirmer mon adresse :\n${confirmUrl}`,
    validity,
    info.text,
    prog.text,
    closing,
    sign.text,
    "—",
    foot.text,
  ].join("\n\n");

  return { subject, html, text };
}

/* ---------------------------------------------------------------------------
 * Informations pratiques (date confirmée, lien de connexion)
 * ------------------------------------------------------------------------- */

export function eventDetailsEmail(args: { cfg: EventConfig; fullName: string; siteUrl: string }): RenderedEmail {
  const { cfg, fullName, siteUrl } = args;
  const subject = `Webinaire « ${cfg.title} » : informations de connexion`;
  const title = "Les informations pour participer";
  const intro = `Votre inscription au webinaire « ${cfg.title} » est bien confirmée. Vous trouverez ci-dessous les informations utiles pour y participer.`;
  const advice = cfg.joinUrl
    ? "Nous vous conseillons de vous connecter quelques minutes avant le début, afin de vérifier votre son et votre connexion."
    : "";
  const info = practical(cfg);
  const prog = programme(cfg);
  const sign = signature(cfg);
  const foot = footer(siteUrl, "Vous recevez ce message parce que vous êtes inscrit(e) à ce webinaire.");

  const html = layout(cfg, {
    preheader: "Date, heure et informations de connexion du webinaire.",
    title,
    body:
      p(`Bonjour ${esc(fullName)},`) +
      p(esc(intro)) +
      (cfg.joinUrl ? button(cfg.joinUrl, "Rejoindre le webinaire") : "") +
      (advice ? p(esc(advice), `color:${C.muted};`) : "") +
      info.html +
      prog.html +
      `<div style="margin-top:32px;padding-top:24px;border-top:1px solid ${C.rule};">${p("Au plaisir de vous retrouver en ligne.")}${sign.html}</div>`,
    footer: foot.html,
  });
  const text = [
    `Bonjour ${fullName},`,
    intro,
    ...(cfg.joinUrl ? [`Rejoindre le webinaire :\n${cfg.joinUrl}`] : []),
    ...(advice ? [advice] : []),
    info.text,
    prog.text,
    "Au plaisir de vous retrouver en ligne.",
    sign.text,
    "—",
    foot.text,
  ].join("\n\n");
  return { subject, html, text };
}

/* ---------------------------------------------------------------------------
 * Lien de connexion à l'administration
 * ------------------------------------------------------------------------- */

export function adminLoginEmail(args: { cfg: EventConfig; loginUrl: string; siteUrl: string }): RenderedEmail {
  const { cfg, loginUrl, siteUrl } = args;
  const subject = "Votre lien de connexion à l'administration du webinaire";
  const title = "Connexion à l'administration";
  const intro =
    "Vous avez demandé à accéder à l'espace d'administration des inscriptions. Utilisez le bouton ci-dessous pour vous connecter.";
  const note = "Ce lien est personnel, à usage unique, et expire au bout d'une heure. Ne le transférez pas.";
  const foot = footer(siteUrl, "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : aucun accès ne sera ouvert.");
  const html = layout(cfg, {
    preheader: "Votre lien de connexion à l'administration.",
    title,
    body:
      p("Bonjour,") +
      p(esc(intro)) +
      button(loginUrl, "Se connecter") +
      p(esc(note), `font-size:13px;color:${C.muted};`) +
      `<div style="margin-top:24px;">${p(`L'équipe d'organisation<br><span style="color:${C.muted};">${esc(organizerNames(cfg))}</span>`, "margin:0;")}</div>`,
    footer: foot.html,
  });
  const text = ["Bonjour,", intro, `Se connecter :\n${loginUrl}`, note, "L'équipe d'organisation", "—", foot.text].join("\n\n");
  return { subject, html, text };
}
