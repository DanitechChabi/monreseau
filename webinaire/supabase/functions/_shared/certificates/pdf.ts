/**
 * Attestation de participation (PDF A4 paysage) générée avec pdf-lib, sans
 * navigateur. Les polices, logos et signatures sont intégrés au code
 * (assets.gen.ts, produit par scripts/embed-assets.ts).
 *
 * Aucune signature ni aucun cachet n'est dessiné s'ils ne sont pas fournis dans
 * la configuration. Aucune mention d'accréditation ou de certification.
 */
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb, setCharacterSpacing } from "pdf-lib";
import QRCode from "qrcode";
import { formatEventDate } from "../datetime.ts";
import type { EventConfig } from "../event.ts";
import { FONTS, LOGOS, SIGNATURES, type EmbeddedImage } from "./assets.gen.ts";

const W = 841.89;
const H = 595.28;
const C = {
  paper: rgb(0.973, 0.98, 0.969), // #F8FAF7
  forest: rgb(0.027, 0.231, 0.196), // #073B32
  emerald: rgb(0.063, 0.725, 0.506), // #10B981
  ink: rgb(0.067, 0.094, 0.153), // #111827
  muted: rgb(0.294, 0.333, 0.388), // #4B5563
};

const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export type CertificateInput = {
  cfg: EventConfig;
  holderName: string;
  code: string;
  issuedAt: Date;
  verifyUrl: string;
};

export type CertificateOutput = {
  bytes: Uint8Array;
  /** Côté du QR code en modules (sert aux tests). */
  qrModules: number;
};

/** « Archivexa (Bénin), Docflow (Niger) et RMBI (Bénin) » */
export function organizersSentence(cfg: EventConfig): string {
  const items = cfg.organizers.map((o) => `${o.name} (${o.country})`);
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}` : (items[0] ?? "");
}

export function formatIssueDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Porto-Novo" }).format(d);
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
}

/** Texte centré, avec espacement des lettres optionnel. */
function centered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = C.ink, spacing = 0) {
  const width = font.widthOfTextAtSize(text, size) + spacing * Math.max(text.length - 1, 0);
  if (spacing) page.pushOperators(setCharacterSpacing(spacing));
  page.drawText(text, { x: (W - width) / 2, y, font, size, color });
  if (spacing) page.pushOperators(setCharacterSpacing(0));
}

/** Découpe en lignes d'une largeur maximale. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

async function embedImage(doc: PDFDocument, img: EmbeddedImage): Promise<PDFImage> {
  const bytes = fromB64(img.data);
  return img.type === "jpg" ? doc.embedJpg(bytes) : doc.embedPng(bytes);
}

/** Vrai si la police contient tous les caractères du texte. */
function covers(font: PDFFont, text: string): boolean {
  const set = new Set(font.getCharacterSet());
  return [...text].every((ch) => ch === " " || set.has(ch.codePointAt(0)!));
}

export async function buildCertificatePdf(input: CertificateInput): Promise<CertificateOutput> {
  const { cfg, code, issuedAt, verifyUrl } = input;
  const holderName = input.holderName.normalize("NFC").replace(/\s+/g, " ").trim();
  const eventDate = formatEventDate(cfg);
  if (!eventDate) throw new Error("La date du webinaire doit être renseignée avant de générer une attestation.");

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Attestation de participation — ${code}`);
  doc.setSubject(`Webinaire « ${cfg.title} »`);
  doc.setKeywords([code, "attestation de participation"]);
  doc.setAuthor(cfg.organizers.map((o) => o.name).join(", "));
  doc.setCreator("Webinaire Archivexa · Docflow");
  doc.setProducer("pdf-lib");
  doc.setCreationDate(issuedAt);
  doc.setModificationDate(issuedAt);

  const title = await doc.embedFont(fromB64(FONTS.title), { subset: true });
  const body = await doc.embedFont(fromB64(FONTS.body), { subset: true });
  const bold = await doc.embedFont(fromB64(FONTS.bodyBold), { subset: true });

  const page = doc.addPage([W, H]);

  // Fond et bordures fines.
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.paper });
  page.drawRectangle({ x: 22, y: 22, width: W - 44, height: H - 44, borderColor: C.forest, borderWidth: 1.2 });
  page.drawRectangle({ x: 29, y: 29, width: W - 58, height: H - 58, borderColor: C.emerald, borderWidth: 0.5 });

  // Logos (ou noms) des organisateurs.
  const marks: { img?: PDFImage; name: string; showName: boolean; w: number; h: number }[] = [];
  for (const o of cfg.organizers) {
    const asset = LOGOS[o.name];
    if (asset) {
      const img = await embedImage(doc, asset);
      const h = 38;
      marks.push({ img, name: o.name, showName: !o.logo?.includesName, w: (img.width / img.height) * h, h });
    } else marks.push({ name: o.name, showName: true, w: bold.widthOfTextAtSize(o.name, 13), h: 38 });
  }
  const gap = 44;
  const totalW = marks.reduce((s, m) => s + Math.max(m.w, m.showName ? bold.widthOfTextAtSize(m.name, 8.5) : 0), 0) + gap * (marks.length - 1);
  let x = (W - totalW) / 2;
  for (const m of marks) {
    const slot = Math.max(m.w, m.showName ? bold.widthOfTextAtSize(m.name, 8.5) : 0);
    if (m.img) page.drawImage(m.img, { x: x + (slot - m.w) / 2, y: 500, width: m.w, height: m.h });
    if (m.showName) {
      const nw = bold.widthOfTextAtSize(m.name, m.img ? 8.5 : 13);
      page.drawText(m.name, { x: x + (slot - nw) / 2, y: m.img ? 486 : 512, font: bold, size: m.img ? 8.5 : 13, color: C.forest });
    }
    x += slot + gap;
  }

  // Titre.
  centered(page, `WEBINAIRE · ${cfg.tagline.toLocaleUpperCase("fr")}`, 452, bold, 8.5, C.emerald, 2);
  centered(page, "ATTESTATION DE PARTICIPATION", 414, title, 30, C.forest, 1.2);
  page.drawRectangle({ x: W / 2 - 32, y: 398, width: 64, height: 1.6, color: C.emerald });

  // Corps.
  centered(page, "Nous attestons que", 362, body, 13, C.muted);
  // Police de secours intégrée en entier (le sous-ensemble casse certains glyphes),
  // uniquement si le nom contient des caractères absents de la police principale.
  const nameFont = covers(title, holderName)
    ? title
    : await doc.embedFont(fromB64(FONTS.fallback), { subset: false });
  let nameSize = 32;
  while (nameFont.widthOfTextAtSize(holderName, nameSize) > 620 && nameSize > 18) nameSize -= 1;
  centered(page, holderName, 320, nameFont, nameSize, C.ink);

  const sentence = `a participé au webinaire « ${cfg.title} », organisé conjointement par ${organizersSentence(cfg)}, le ${eventDate}.`;
  let y = 284;
  for (const line of wrap(sentence, body, 13, 600)) {
    centered(page, line, y, body, 13, C.ink);
    y -= 20;
  }
  if (cfg.attestation.durationMinutes) {
    centered(page, `Durée : ${formatDuration(cfg.attestation.durationMinutes)}`, y - 4, body, 11, C.muted);
  }

  // Signataires (uniquement ceux fournis dans la configuration).
  const signers = cfg.attestation.signatories;
  if (signers.length) {
    const colW = 170;
    const startX = (W - colW * signers.length - 30 * (signers.length - 1)) / 2;
    for (const [i, s] of signers.entries()) {
      const cx = startX + i * (colW + 30);
      const sig = SIGNATURES[s.name];
      if (sig) {
        const img = await embedImage(doc, sig);
        const h = 38;
        const w = Math.min((img.width / img.height) * h, colW);
        page.drawImage(img, { x: cx + (colW - w) / 2, y: 140, width: w, height: h });
      }
      page.drawLine({ start: { x: cx + 15, y: 134 }, end: { x: cx + colW - 15, y: 134 }, thickness: 0.6, color: C.muted });
      const nw = bold.widthOfTextAtSize(s.name, 10);
      page.drawText(s.name, { x: cx + (colW - nw) / 2, y: 120, font: bold, size: 10, color: C.ink });
      for (const [j, l] of wrap(s.title, body, 8.5, colW).entries()) {
        const lw = body.widthOfTextAtSize(l, 8.5);
        page.drawText(l, { x: cx + (colW - lw) / 2, y: 107 - j * 11, font: body, size: 8.5, color: C.muted });
      }
    }
  }

  // Numéro, date d'émission, vérification.
  page.drawText(`N° ${code}`, { x: 60, y: 82, font: bold, size: 10, color: C.forest });
  page.drawText(`Délivrée le ${formatIssueDate(issuedAt)}`, { x: 60, y: 67, font: body, size: 9, color: C.muted });
  page.drawText(`Vérification : ${verifyUrl}`, { x: 60, y: 54, font: body, size: 7.5, color: C.muted });

  // QR code vers la page publique de vérification.
  const qr = QRCode.create(verifyUrl, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const size = 74;
  const cell = size / n;
  const qx = W - 60 - size;
  const qy = 50;
  page.drawRectangle({ x: qx - 4, y: qy - 4, width: size + 8, height: size + 8, color: rgb(1, 1, 1) });
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.data[r * n + c]) {
        page.drawRectangle({ x: qx + c * cell, y: qy + (n - 1 - r) * cell, width: cell + 0.02, height: cell + 0.02, color: C.ink });
      }
    }
  }
  const lbl = "Scanner pour vérifier";
  page.drawText(lbl, { x: qx + (size - body.widthOfTextAtSize(lbl, 7)) / 2, y: qy - 14, font: body, size: 7, color: C.muted });

  return { bytes: await doc.save(), qrModules: n };
}
