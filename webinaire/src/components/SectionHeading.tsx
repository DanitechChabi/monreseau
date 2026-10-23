import { useRef, type ReactNode } from "react";
import { useLineReveal } from "../motion/useLineReveal";
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
  const h2 = useRef<HTMLHeadingElement>(null);
  useLineReveal(h2);
  return (
    <div className="max-w-3xl">
      <Reveal>
        <p className={`eyebrow ${dark ? "text-emeraude" : "text-forest"}`}>{eyebrow}</p>
      </Reveal>
      <h2 ref={h2} id={id} className={`mt-3 text-h2 ${dark ? "text-paper" : "text-forest"}`}>
        {title}
      </h2>
      {intro && (
        <Reveal delay={0.15}>
          <p className={`mt-5 text-lead ${dark ? "text-mist" : "text-ink-muted"}`}>{intro}</p>
        </Reveal>
      )}
    </div>
  );
}
