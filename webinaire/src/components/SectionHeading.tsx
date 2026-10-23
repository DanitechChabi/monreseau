import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

type Props = {
  id?: string;
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  tone?: "light" | "dark";
};

export function SectionHeading({ id, eyebrow, title, intro, tone = "light" }: Props) {
  const dark = tone === "dark";
  return (
    <Reveal className="max-w-3xl">
      <p className={`eyebrow ${dark ? "text-emeraude" : "text-forest"}`}>{eyebrow}</p>
      <h2 id={id} className={`mt-3 text-h2 ${dark ? "text-paper" : "text-forest"}`}>
        {title}
      </h2>
      {intro && <p className={`mt-5 text-lead ${dark ? "text-mist" : "text-ink-muted"}`}>{intro}</p>}
    </Reveal>
  );
}
