/**
 * Affiche du webinaire : A4 portrait (PDF vectoriel + PNG 300 dpi) et format
 * réseaux sociaux 4:5 (PNG 1080 × 1350).
 *
 *   npm run poster                         → affiches dans poster/
 *   POSTER_DATE=2026-12-03 POSTER_TIME=10:00 npm run poster
 *
 * Tout le contenu vient de supabase/functions/_shared/event.ts. La date et
 * l'heure ne figurent que si elles sont fournies (jamais de valeur inventée).
 * Chromium : CHROMIUM_PATH, sinon le navigateur installé par Playwright.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import QRCode from "qrcode";
import { chromium } from "playwright-core";
import { formatEventDate, formatEventTimes } from "../supabase/functions/_shared/datetime.ts";
import { event, withSettings } from "../supabase/functions/_shared/event.ts";
import { PHOTOS } from "../src/config/photos.ts";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(root, "poster");
const SITE = (process.env.POSTER_SITE_URL ?? "https://webinaire-archivexa-docflow.vercel.app").replace(/\/+$/, "");
const cfg = withSettings(event, { date: process.env.POSTER_DATE ?? null, time: process.env.POSTER_TIME ?? null });

const dataUri = (p: string, mime: string) => `data:${mime};base64,${readFileSync(resolve(root, p)).toString("base64")}`;
const font = (pkg: string, file: string) => dataUri(`node_modules/@expo-google-fonts/${pkg}/${file}`, "font/ttf");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const registerUrl = `${SITE}/#inscription`;
const qrSvg = await QRCode.toString(registerUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#073B32", light: "#0000" } });

const speakers = new Map(cfg.speakers.map((s) => [s.id, s]));
const talks = cfg.programme.flatMap((item, i) => (item.kind === "talk" ? [{ n: i + 1, item, sp: speakers.get(item.speakerId)! }] : []));
const qa = cfg.programme.find((p) => p.kind === "qa");
const date = formatEventDate(cfg);
const times = formatEventTimes(cfg);
const bg = PHOTOS["toronto-rayonnages"];

function html(variant: "a4" | "social", heroBg: string) {
  const css = `
  @font-face { font-family: Fraunces; font-weight: 600; src: url(${font("fraunces", "600SemiBold/Fraunces_600SemiBold.ttf")}); }
  @font-face { font-family: Public Sans; font-weight: 400; src: url(${font("public-sans", "400Regular/PublicSans_400Regular.ttf")}); }
  @font-face { font-family: Public Sans; font-weight: 600; src: url(${font("public-sans", "600SemiBold/PublicSans_600SemiBold.ttf")}); }
  @font-face { font-family: Public Sans; font-weight: 700; src: url(${font("public-sans", "700Bold/PublicSans_700Bold.ttf")}); }
  :root {
    --forest: #073b32; --deep: #04261f; --emerald: #10b981; --paper: #f8faf7; --ink: #111827; --mist: #c3d6cf; --muted: #4b5563; --line: #dde5df;
  }
  @page { size: 210mm 297mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: var(--paper); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Public Sans", sans-serif; color: var(--ink); }
  /* Unité de mise en page : 1 u = 1/210 de la largeur (A4 : 1 u = 1 mm). */
  .poster { --w: ${variant === "a4" ? "210mm" : "1080px"}; --u: calc(var(--w) / 210); width: var(--w); height: ${variant === "a4" ? "297mm" : "1350px"};
    position: relative; overflow: hidden; display: flex; flex-direction: column; background: var(--paper); }

  /* ---------- Partie haute : photo d'archives teintée ---------- */
  .hero { position: relative; color: #fff; padding: calc(${variant === "a4" ? 13 : 11} * var(--u)) calc(15 * var(--u)) calc(${variant === "a4" ? 9 : 7} * var(--u)); isolation: isolate; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
  .hero > * { flex-shrink: 0; }
  .hero > .spacer { flex: 1 1 0; min-height: calc(${variant === "a4" ? 6 : 4} * var(--u)); }
  .hero::before { content: ""; position: absolute; inset: 0; z-index: -2;
    background: url(${heroBg}) center 35% / cover; }
  .hero::after { content: ""; position: absolute; inset: 0; z-index: -1;
    background: linear-gradient(180deg, rgba(4,38,31,.93) 0%, rgba(7,59,50,.88) 45%, rgba(4,38,31,.97) 100%); }
  .grid { position: absolute; inset: 0; z-index: -1; opacity: .07;
    background-image: linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px);
    background-size: calc(12 * var(--u)) calc(12 * var(--u));
    mask-image: radial-gradient(ellipse at 80% 20%, #000 10%, transparent 70%); }
  .top { display: flex; align-items: center; justify-content: space-between; }
  .pill { display: inline-flex; align-items: center; gap: calc(2 * var(--u)); background: var(--emerald); color: var(--ink);
    font-weight: 700; font-size: calc(3.3 * var(--u)); letter-spacing: .14em; text-transform: uppercase; padding: calc(1.6 * var(--u)) calc(3.6 * var(--u)); border-radius: 999px; }
  .tag { font-size: calc(3.1 * var(--u)); font-weight: 600; letter-spacing: .2em; text-transform: uppercase; color: var(--mist); }
  .tag b { color: var(--emerald); font-weight: 700; }
  h1 { font-family: Fraunces, serif; font-weight: 600; line-height: 1.02; letter-spacing: -.01em; margin-top: calc(${variant === "a4" ? 9 : 8} * var(--u));
    font-size: calc(${variant === "a4" ? 14.5 : 12.5} * var(--u)); }
  h1 .q { display: block; color: #fff; }
  h1 .a { display: block; color: var(--emerald); margin-top: calc(2 * var(--u)); }
  .rule { width: calc(18 * var(--u)); height: calc(.9 * var(--u)); background: var(--emerald); margin: calc(${variant === "a4" ? 6 : 5} * var(--u)) 0 calc(5 * var(--u)); }
  .lead { font-size: calc(4.6 * var(--u)); line-height: 1.5; color: var(--mist); max-width: calc(165 * var(--u)); }

  /* Intervenants */
  .speakers-title { margin-top: 0; font-size: calc(3.1 * var(--u)); font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: var(--emerald); }
  .speakers { display: grid; grid-template-columns: repeat(3, 1fr); gap: calc(5 * var(--u)); margin-top: calc(4 * var(--u)); }
  .sp { border-top: 1px solid rgba(195,214,207,.28); padding-top: calc(4.5 * var(--u)); }
  .sp img { width: calc(${variant === "a4" ? 20 : 17} * var(--u)); height: calc(${variant === "a4" ? 20 : 17} * var(--u)); border-radius: 50%; object-fit: cover;
    box-shadow: 0 0 0 calc(.8 * var(--u)) var(--deep), 0 0 0 calc(1.3 * var(--u)) var(--emerald); }
  .sp .n { margin-top: calc(3.6 * var(--u)); font-size: calc(2.9 * var(--u)); font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--emerald); }
  .sp .name { margin-top: calc(1.4 * var(--u)); font-size: calc(4.3 * var(--u)); font-weight: 600; color: #fff; }
  .sp .t { margin-top: calc(1.2 * var(--u)); font-family: Fraunces, serif; font-size: calc(4.6 * var(--u)); line-height: 1.2; color: var(--mist); }
  .qa { margin-top: calc(4.5 * var(--u)); font-size: calc(3.6 * var(--u)); color: var(--mist); }
  .qa b { color: #fff; font-weight: 600; }

  /* ---------- Bandeau d'informations ---------- */
  .info { flex: none; display: grid; grid-template-columns: 1fr auto; gap: calc(8 * var(--u)); align-items: center; background: var(--paper);
    padding: calc(${variant === "a4" ? 7 : 6} * var(--u)) calc(15 * var(--u)); border-bottom: 1px solid var(--line); }
  .info .left { display: flex; flex-direction: column; gap: calc(${variant === "a4" ? 7 : 5} * var(--u)); }
  .facts { display: grid; grid-template-columns: repeat(2, auto); gap: calc(${variant === "a4" ? 5 : 4} * var(--u)) calc(14 * var(--u)); white-space: nowrap; justify-content: start; }
  .fact .k { font-size: calc(2.7 * var(--u)); font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: var(--muted); }
  .fact .v { margin-top: calc(1.4 * var(--u)); font-family: Fraunces, serif; font-size: calc(5.6 * var(--u)); color: var(--forest); line-height: 1.15; }
  .fact .v small { display: block; font-family: "Public Sans"; font-size: calc(3.1 * var(--u)); color: var(--muted); margin-top: calc(.6 * var(--u)); }
  .cta { display: flex; align-items: center; gap: calc(4 * var(--u)); }
  .cta .btn { background: var(--forest); color: #fff; font-weight: 700; font-size: calc(3.8 * var(--u)); padding: calc(2.6 * var(--u)) calc(5.4 * var(--u)); border-radius: 999px; }
  .cta .url { font-size: calc(3.3 * var(--u)); color: var(--muted); }
  .cta .url b { color: var(--forest); font-weight: 600; }
  .qr { display: flex; flex-direction: column; align-items: center; gap: calc(2 * var(--u)); }
  .qr .box { width: calc(${variant === "a4" ? 32 : 27} * var(--u)); height: calc(${variant === "a4" ? 32 : 27} * var(--u)); padding: calc(2.4 * var(--u)); background: #fff; border: 1px solid var(--line); border-radius: calc(2.5 * var(--u)); }
  .qr .box svg { width: 100%; height: 100%; display: block; }
  .qr span { font-size: calc(2.7 * var(--u)); font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--forest); }

  /* ---------- Organisateurs ---------- */
  .org { flex: none; background: #fff; padding: calc(${variant === "a4" ? 7 : 5.5} * var(--u)) calc(15 * var(--u)) calc(${variant === "a4" ? 5 : 4} * var(--u)); }
  .org .row { display: flex; align-items: center; justify-content: space-between; gap: calc(6 * var(--u)); }
  .org .k { font-size: calc(2.7 * var(--u)); font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: var(--muted); white-space: nowrap; }
  .logos { display: flex; align-items: center; gap: calc(9 * var(--u)); }
  .logo { display: flex; align-items: center; gap: calc(2.6 * var(--u)); }
  .logo img { height: calc(${variant === "a4" ? 11 : 9} * var(--u)); width: auto; display: block; }
  .logo .nm { font-family: Fraunces, serif; font-size: calc(5.2 * var(--u)); color: var(--forest); line-height: 1; }
  .logo .ct { display: block; font-family: "Public Sans"; font-size: calc(2.6 * var(--u)); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-top: calc(1 * var(--u)); }
  .credit { margin-top: calc(3.5 * var(--u)); font-size: calc(2.1 * var(--u)); color: #8a949c; }
  `;

  const facts = [
    { k: "Format", v: "En ligne", s: "Visioconférence" },
    { k: "Participation", v: "Gratuite", s: "Inscription obligatoire" },
    date
      ? { k: "Date", v: date.charAt(0).toUpperCase() + date.slice(1), s: times ?? "" }
      : { k: "Date et lien", v: "Par e-mail", s: "Communiqués aux inscrits" },
    { k: "Attestation", v: "Délivrée", s: "Remise aux participants" },
  ];

  const logos = cfg.organizers
    .map((o) => {
      const img = o.logo ? `<img src="${dataUri(`public${o.logo.src}`, "image/png")}" alt="${esc(o.name)}">` : "";
      const label = !o.logo || !o.logo.includesName ? `<div class="nm">${esc(o.name)}<span class="ct">${esc(o.country)}</span></div>` : `<div><span class="ct">${esc(o.country)}</span></div>`;
      return `<div class="logo">${img}${label}</div>`;
    })
    .join("");

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Affiche — ${esc(cfg.title)}</title><style>${css}</style></head>
<body><main class="poster ${variant}">
  <section class="hero">
    <div class="grid"></div>
    <div class="top">
      <span class="pill">Webinaire gratuit</span>
      <span class="tag">Regards croisés <b>Niger · Bénin</b></span>
    </div>
    <h1><span class="q">Vos documents vous échappent-ils&nbsp;?</span><span class="a">Reprenez le contrôle de votre information.</span></h1>
    <div class="rule"></div>
    ${variant === "a4" ? `<p class="lead">Documents introuvables, archives désorganisées, fichiers dispersés&nbsp;: découvrez comment mieux organiser, sécuriser et exploiter l'information au sein de votre organisation.</p>` : ""}
    <div class="spacer"></div>
    <p class="speakers-title">Programme · trois intervenants</p>
    <div class="speakers">
      ${talks
        .map(
          ({ n, item, sp }) => `<div class="sp">
        <img src="${dataUri(`public${sp.portrait}`, "image/jpeg")}" alt="">
        <p class="n">Partie ${n}</p>
        <p class="name">${esc(sp.name)}</p>
        <p class="t">${esc(item.kind === "talk" ? item.title : "")}</p>
      </div>`,
        )
        .join("")}
    </div>
    ${qa ? `<p class="qa">Puis <b>${esc(qa.title.charAt(0).toLowerCase() + qa.title.slice(1))}</b>. Des exemples concrets du Bénin et du Niger.</p>` : ""}
  </section>

  <section class="info">
    <div class="left">
      <div class="facts">
        ${facts.map((f) => `<div class="fact"><p class="k">${f.k}</p><p class="v">${esc(f.v)}${f.s ? `<small>${esc(f.s)}</small>` : ""}</p></div>`).join("")}
      </div>
      <div class="cta"><span class="btn">Réservez votre place</span><span class="url">${esc(SITE.replace(/^https?:\/\//, ""))}</span></div>
    </div>
    <div class="qr"><div class="box">${qrSvg}</div><span>Scannez pour vous inscrire</span></div>
  </section>

  <section class="org">
    <div class="row"><p class="k">Organisé par</p><div class="logos">${logos}</div></div>
    <p class="credit">Photo : ${esc(bg.caption)}, ${esc(bg.author)}, ${esc(bg.license)}.</p>
  </section>
</main></body></html>`;
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  // Le PDF ne prend pas en charge le WebP ni les filtres CSS : Chromium y
  // incorporerait la photo décompressée (≈ 14 Mo). On la pré-rend donc une fois
  // en JPEG, filtre appliqué.
  const photo = await browser.newPage({ viewport: { width: 1920, height: 1280 } });
  await photo.setContent(`<body style="margin:0"><img src="${dataUri("public/images/toronto-rayonnages-1920.webp", "image/webp")}" style="display:block;filter:saturate(.45) contrast(1.05)"></body>`);
  const img = photo.locator("img");
  await img.evaluate((el: HTMLImageElement) => el.decode());
  const heroBg = `data:image/jpeg;base64,${(await img.screenshot({ type: "jpeg", quality: 85 })).toString("base64")}`;
  await photo.close();

  for (const variant of ["a4", "social"] as const) {
    const file = resolve(outDir, `affiche-${variant}.html`);
    writeFileSync(file, html(variant, heroBg));
    const page = await browser.newPage(
      variant === "a4"
        ? { viewport: { width: 794, height: 1123 }, deviceScaleFactor: 3.125 } // 210 mm × 297 mm, rendu 2480 × 3508 (300 dpi)
        : { viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 },
    );
    await page.goto(`file://${file}`);
    await page.evaluate(() => document.fonts.ready);
    const box = (await page.locator(".poster").boundingBox())!;
    await page.screenshot({ path: resolve(outDir, `affiche-${variant}.png`), clip: box });
    if (variant === "a4") await page.pdf({ path: resolve(outDir, "affiche-a4.pdf"), width: "210mm", height: "297mm", printBackground: true, preferCSSPageSize: true });
    // Contrôle : aucun contenu ne doit déborder de l'affiche.
    const overflow = await page.evaluate(() => {
      // Chaque bloc doit tenir dans sa propre section (les sections masquent leur débordement).
      return [...document.querySelectorAll(".poster > section")].some((sec) => {
        const p = sec.getBoundingClientRect();
        return [...sec.querySelectorAll("*")].some((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && !el.classList.contains("grid") && (r.bottom > p.bottom + 1 || r.right > p.right + 1);
        });
      });
    });
    console.log(`${variant} : ${overflow ? "ATTENTION, contenu hors cadre" : "OK"}`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`Affiches écrites dans ${outDir}`);
