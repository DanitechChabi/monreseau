import { motion, useInView, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useLightMotion } from "../hooks/useMediaQuery";

/*
 * Séquence unique du hero : des documents éparpillés se rangent dans les
 * dossiers d'un plan de classement, puis l'arborescence se dessine.
 * Coordonnées en unités du viewBox (560 × 460) : l'illustration s'adapte à
 * toutes les largeurs sans recalcul.
 */

const DOC_W = 84;
const DOC_H = 108;
const FOLDER_W = 150;
const FOLDER_X = [30, 205, 380] as const;
const FOLDERS = [
  { code: "100", label: "Administration" },
  { code: "200", label: "Finances" },
  { code: "300", label: "Personnel" },
] as const;

// Positions de départ (coin haut gauche + rotation), volontairement désordonnées.
const SCATTER: Array<[number, number, number]> = [
  [18, 28, -16],
  [128, 4, 9],
  [238, 46, -5],
  [352, 12, 14],
  [448, 92, -11],
  [70, 150, 7],
  [196, 160, -13],
  [318, 140, 18],
  [410, 178, 5],
];

type Doc = { i: number; folder: number; fx: number; fy: number; dx: number; dy: number; r: number };

function buildDocs(count: number): Doc[] {
  return SCATTER.slice(0, count).map(([sx, sy, r], i) => {
    const folder = i % 3;
    const slot = Math.floor(i / 3);
    const fx = FOLDER_X[folder]! + 16 + slot * 17;
    const fy = 258 + slot * 10;
    return { i, folder, fx, fy, dx: sx - fx, dy: sy - fy, r };
  });
}

type Phase = "hidden" | "scattered" | "ordered";

export function HeroIllustration() {
  const reduce = useReducedMotion();
  const light = useLightMotion();
  const docs = buildDocs(light ? 6 : 9);
  const ref = useRef<HTMLElement>(null);
  // Sur mobile l'illustration est sous la ligne de flottaison : la séquence attend d'être visible.
  const inView = useInView(ref, { once: true, amount: 0.45 });
  const [phase, setPhase] = useState<Phase>("hidden");

  useEffect(() => {
    if (reduce || !inView) return;
    setPhase("scattered");
    const id = window.setTimeout(() => setPhase("ordered"), light ? 1100 : 1500);
    return () => window.clearTimeout(id);
  }, [reduce, light, inView]);

  const current: Phase = reduce ? "ordered" : phase;
  const settle = light ? 0.9 : 1.35; // moment où le dernier document est rangé

  const docVariants: Variants = {
    hidden: (d: Doc) => ({ opacity: 0, x: d.dx, y: d.dy - 28, rotate: d.r * 0.5 }),
    scattered: (d: Doc) => ({
      opacity: 1,
      x: d.dx,
      y: d.dy,
      rotate: d.r,
      transition: { duration: 0.6, delay: 0.15 + d.i * 0.05, ease: [0.22, 1, 0.36, 1] },
    }),
    ordered: (d: Doc) => ({
      opacity: 1,
      x: 0,
      y: 0,
      rotate: 0,
      transition: light
        ? { duration: 0.6, delay: d.i * 0.08, ease: [0.22, 1, 0.36, 1] }
        : { type: "spring", stiffness: 85, damping: 15, mass: 0.9, delay: d.i * 0.11 },
    }),
  };

  const tagVariants: Variants = {
    hidden: { opacity: 0 },
    scattered: { opacity: 0 },
    ordered: { opacity: 1, transition: { delay: settle * 0.6, duration: 0.4 } },
  };

  const lateVariants = (delay: number): Variants => ({
    hidden: { opacity: 0 },
    scattered: { opacity: 0 },
    ordered: { opacity: 1, transition: { delay, duration: 0.5 } },
  });

  const lineVariants = (delay: number): Variants => ({
    hidden: { pathLength: 0, opacity: 0 },
    scattered: { pathLength: 0, opacity: 0 },
    ordered: { pathLength: 1, opacity: 1, transition: { delay, duration: 0.7, ease: "easeInOut" } },
  });

  return (
    <figure ref={ref} className="relative mx-auto w-full max-w-[560px]">
      <svg
        viewBox="0 0 560 460"
        className="h-auto w-full overflow-visible"
        role="img"
        aria-labelledby="hero-illu-title"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <title id="hero-illu-title">
          Illustration : des documents éparpillés se rangent dans les dossiers d'un plan de classement.
        </title>

        {/* Arborescence du plan de classement */}
        <motion.g initial={reduce ? false : "hidden"} animate={current} variants={lateVariants(settle)}>
          <rect x="180" y="58" width="200" height="46" rx="23" fill="#0E5246" stroke="#10B981" strokeWidth="1.5" />
          <text x="280" y="86" textAnchor="middle" fill="#F8FAF7" fontSize="15" fontWeight="600">
            Plan de classement
          </text>
        </motion.g>
        <g fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round">
          <motion.path
            d="M280 104 V150"
            initial={reduce ? false : "hidden"}
            animate={current}
            variants={lineVariants(settle + 0.2)}
          />
          {FOLDER_X.map((x, f) => (
            <motion.path
              key={f}
              d={`M280 150 H${x + 29} V244`}
              initial={reduce ? false : "hidden"}
              animate={current}
              variants={lineVariants(settle + 0.45)}
            />
          ))}
        </g>

        {/* Dos des dossiers */}
        {FOLDER_X.map((x) => (
          <g key={`back-${x}`}>
            <rect x={x} y="248" width="58" height="26" rx="6" fill="#0E5246" />
            <rect x={x} y="262" width={FOLDER_W} height="170" rx="10" fill="#0E5246" />
          </g>
        ))}

        {/* Documents */}
        {docs.map((d) => (
          <g key={d.i} transform={`translate(${d.fx} ${d.fy})`}>
            <motion.g custom={d} variants={docVariants} initial={reduce ? false : "hidden"} animate={current}>
              <rect width={DOC_W} height={DOC_H} rx="6" fill="#F8FAF7" stroke="#C3D6CF" />
              <path d={`M${DOC_W - 18} 0 V14 a4 4 0 0 0 4 4 H${DOC_W}`} fill="#DDE5DF" />
              <rect x="12" y="24" width="52" height="5" rx="2.5" fill="#B9C8C1" />
              <rect x="12" y="36" width="60" height="4" rx="2" fill="#DDE5DF" />
              <rect x="12" y="46" width="44" height="4" rx="2" fill="#DDE5DF" />
              <rect x="12" y="56" width="56" height="4" rx="2" fill="#DDE5DF" />
              <motion.rect x="12" y="10" width="24" height="6" rx="3" fill="#10B981" variants={tagVariants} />
            </motion.g>
          </g>
        ))}

        {/* Façades des dossiers */}
        {FOLDER_X.map((x, f) => (
          <g key={`front-${x}`}>
            <rect x={x} y="304" width={FOLDER_W} height="128" rx="10" fill="#136456" />
            <rect x={x + 10} y="304" width={FOLDER_W - 20} height="1.5" fill="#10B981" opacity="0.6" />
            <motion.g initial={reduce ? false : "hidden"} animate={current} variants={lateVariants(settle + 0.1 + f * 0.12)}>
              <text x={x + 18} y="346" fill="#10B981" fontSize="13" fontWeight="700" letterSpacing="1.5">
                {FOLDERS[f]!.code}
              </text>
              <text x={x + 18} y="370" fill="#F8FAF7" fontSize="15" fontWeight="600">
                {FOLDERS[f]!.label}
              </text>
              <circle cx={x + FOLDER_W - 26} cy="404" r="11" fill="#10B981" />
              <path
                d={`M${x + FOLDER_W - 31} 404 l3.5 3.5 l6.5 -7`}
                fill="none"
                stroke="#073B32"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.g>
          </g>
        ))}
      </svg>
    </figure>
  );
}
