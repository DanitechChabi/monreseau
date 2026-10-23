/**
 * Intègre aux Edge Functions les fichiers nécessaires aux attestations PDF :
 * polices, logos des organisateurs et images de signature déclarées dans
 * supabase/functions/_shared/event.ts. À relancer après avoir ajouté un logo
 * ou une signature :  npm run embed-assets
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { event } from "../supabase/functions/_shared/event.ts";

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "supabase/functions/_shared/certificates/assets.gen.ts");
const b64 = (p: string) => readFileSync(p).toString("base64");
const font = (pkg: string, file: string) => b64(resolve(root, "node_modules/@expo-google-fonts", pkg, file));

const fonts = {
  title: font("fraunces", "600SemiBold/Fraunces_600SemiBold.ttf"),
  body: font("public-sans", "400Regular/PublicSans_400Regular.ttf"),
  bodyBold: font("public-sans", "600SemiBold/PublicSans_600SemiBold.ttf"),
  // Secours pour les caractères absents des polices principales (ɛ, ɔ…).
  fallback: font("noto-serif", "600SemiBold/NotoSerif_600SemiBold.ttf"),
};

const image = (publicPath: string | null) => {
  if (!publicPath) return null;
  const file = resolve(root, "public", publicPath.replace(/^\//, ""));
  if (!existsSync(file)) {
    console.warn(`Introuvable, ignoré : ${publicPath}`);
    return null;
  }
  const type = /\.jpe?g$/i.test(file) ? "jpg" : "png";
  return { type, data: b64(file) };
};

const logos = Object.fromEntries(
  event.organizers.map((o) => [o.name, o.logo ? image(o.logo.src) : null]).filter(([, v]) => v),
);
const signatures = Object.fromEntries(
  event.attestation.signatories.map((s) => [s.name, image(s.signatureImage)]).filter(([, v]) => v),
);

writeFileSync(
  out,
  `// Fichier généré par scripts/embed-assets.ts — ne pas modifier à la main.
export type EmbeddedImage = { type: "png" | "jpg"; data: string };
export const FONTS = ${JSON.stringify(fonts)} as const;
export const LOGOS: Record<string, EmbeddedImage> = ${JSON.stringify(logos)};
export const SIGNATURES: Record<string, EmbeddedImage> = ${JSON.stringify(signatures)};
`,
);
console.log(`Écrit : ${out} — ${Object.keys(logos).length} logo(s), ${Object.keys(signatures).length} signature(s)`);
