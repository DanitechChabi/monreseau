import type { Organizer } from "../config/event";

type Props = { org: Organizer; tone?: "light" | "dark"; size?: "sm" | "lg" };

/** Logo si fourni dans la configuration, sinon nom en texte stylé (jamais de faux logo). */
export function OrgMark({ org, tone = "dark", size = "sm" }: Props) {
  if (org.logo) {
    return <img src={org.logo} alt={org.name} className={size === "lg" ? "h-14 w-auto" : "h-7 w-auto"} />;
  }
  return (
    <span
      className={`font-display font-semibold tracking-tight ${size === "lg" ? "text-h2" : "text-h3"} ${
        tone === "dark" ? "text-paper" : "text-forest"
      }`}
    >
      {org.name}
    </span>
  );
}
