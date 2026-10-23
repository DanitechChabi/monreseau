import type { CSSProperties } from "react";
import { PHOTOS, type PhotoKey } from "../config/photos";

/** Photo réelle en WebP responsive (640 / 1280 / 1920 px), dimensions déclarées. */
export function Photo({
  id,
  sizes = "100vw",
  className,
  style,
  priority = false,
  alt,
}: {
  id: PhotoKey;
  sizes?: string;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
  /** Texte alternatif ; vide si la photo est décorative. */
  alt?: string;
}) {
  const p = PHOTOS[id];
  return (
    <img
      src={`/images/${id}-1280.webp`}
      srcSet={[640, 1280, 1920].map((w) => `/images/${id}-${w}.webp ${w}w`).join(", ")}
      sizes={sizes}
      width={p.width}
      height={p.height}
      alt={alt ?? p.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={className}
      style={style}
    />
  );
}

/** Crédit discret posé sur la photo (licence CC BY-SA : auteur, licence, source). */
export function PhotoCredit({ id, className = "" }: { id: PhotoKey; className?: string }) {
  const p = PHOTOS[id];
  return (
    <figcaption className={`text-[0.6875rem] leading-snug text-paper/80 ${className}`}>
      {p.caption} · Photo{" "}
      <a href={p.source} className="underline decoration-paper/40 underline-offset-2 hover:text-paper" rel="noopener" target="_blank">
        {p.author}
      </a>
      ,{" "}
      <a href={p.licenseUrl} className="underline decoration-paper/40 underline-offset-2 hover:text-paper" rel="noopener license" target="_blank">
        {p.license}
      </a>
    </figcaption>
  );
}
