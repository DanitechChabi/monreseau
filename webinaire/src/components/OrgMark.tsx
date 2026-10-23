import type { Organizer } from "../config/event";

/**
 * Logo fourni par l'organisation, accompagné du nom quand le logo ne le contient
 * pas. Sans logo : nom en texte stylé (jamais de faux logo). Prévu pour fond clair.
 */
export function OrgMark({ org }: { org: Organizer }) {
  const name = <span className="font-display text-h2 font-semibold tracking-tight text-forest">{org.name}</span>;
  if (!org.logo) return name;
  const { src, width, height, includesName } = org.logo;
  return (
    <span className="flex items-center gap-4">
      <img
        src={src}
        width={width}
        height={height}
        alt={includesName ? org.name : ""}
        className={includesName ? "h-14 w-auto" : "h-14 w-14 rounded-xl"}
        loading="lazy"
        decoding="async"
      />
      {!includesName && name}
    </span>
  );
}
