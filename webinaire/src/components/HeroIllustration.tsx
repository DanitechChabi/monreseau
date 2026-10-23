import { motion, useInView, useMotionValue, useReducedMotion, useSpring, type Variants } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useLightMotion, useMediaQuery } from "../hooks/useMediaQuery";
import { MQ } from "../motion/gsap";

/*
 * Séquence du hero : des feuilles flottent, puis chacune décrit un arc, retombe
 * dans son dossier (gravité, léger rebond, ombre qui se resserre) ; le dossier
 * fléchit à chaque réception ; l'arborescence du plan de classement se dessine
 * et un balayage « d'indexation » parcourt les dossiers.
 * Coordonnées en unités du viewBox (560 × 460).
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

/** Profil de vol : montée (décélération), chute (accélération), rebond, repos. */
const FLIGHT_TIMES = [0, 0.36, 0.84, 1];
const FLIGHT_EASE = ["easeOut", "easeIn", "easeOut"] as const;

/** Images-clés d'un « tassement » du dossier à chaque réception de feuille. */
function bumpKeyframes(landings: number[], total: number) {
  const values: number[] = [0];
  const times: number[] = [0];
  for (const t of landings) {
    values.push(0, 3.5, 0);
    times.push(Math.max(t - 0.01, 0) / total, (t + 0.07) / total, (t + 0.32) / total);
  }
  values.push(0);
  times.push(1);
  return { values, times };
}

export function HeroIllustration() {
  const reduce = useReducedMotion();
  const light = useLightMotion();
  const tiltEnabled = useMediaQuery(MQ.finePointer);
  const docs = buildDocs(light ? 6 : 9);
  const ref = useRef<HTMLElement>(null);
  // Sur mobile l'illustration est sous la ligne de flottaison : la séquence attend d'être visible.
  const inView = useInView(ref, { once: true, amount: 0.45 });
  const [phase, setPhase] = useState<Phase>("hidden");

  useEffect(() => {
    if (reduce || !inView) return;
    setPhase("scattered");
    const id = window.setTimeout(() => setPhase("ordered"), light ? 1500 : 2300);
    return () => window.clearTimeout(id);
  }, [reduce, light, inView]);

  const current: Phase = reduce ? "ordered" : phase;
  const flightDuration = light ? 0.95 : 1.3;
  const stagger = light ? 0.1 : 0.13;
  const landing = (d: Doc) => d.i * stagger + flightDuration * FLIGHT_TIMES[2]!;
  const settle = Math.max(...docs.map(landing)) + 0.25;

  // Inclinaison 3D au survol (souris uniquement).
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 120, damping: 18 });
  const sry = useSpring(ry, { stiffness: 120, damping: 18 });

  const flight: Variants = {
    hidden: (d: Doc) => ({ opacity: 0, x: d.dx, y: d.dy - 40, rotate: d.r * 0.4, scale: 0.96 }),
    scattered: (d: Doc) => ({
      opacity: 1,
      x: d.dx,
      y: d.dy,
      rotate: d.r,
      scale: 1,
      transition: { duration: 0.9, delay: 0.1 + d.i * 0.06, ease: [0.22, 1, 0.36, 1] },
    }),
    ordered: (d: Doc) => {
      const lift = 26 + (d.i % 3) * 10;
      const side = d.r > 0 ? 1 : -1;
      return {
        opacity: 1,
        x: [d.dx, d.dx * 0.38, 0, 0],
        y: [d.dy, d.dy - lift, 7, 0],
        rotate: [d.r, -d.r * 0.45, side * 1.6, 0],
        scale: [1, 1.1, 0.985, 1],
        transition: {
          duration: flightDuration,
          delay: d.i * stagger,
          times: FLIGHT_TIMES,
          ease: [...FLIGHT_EASE],
          opacity: { duration: 0.2 },
        },
      };
    },
  };

  // Ombre portée : large et diffuse en l'air, serrée et plus dense au contact.
  const shadow: Variants = {
    hidden: { opacity: 0, x: 18, y: 26 },
    scattered: { opacity: 0.42, x: 16, y: 24, transition: { duration: 0.9 } },
    ordered: (d: Doc) => ({
      opacity: [0.42, 0.28, 0.55, 0.45],
      x: [16, 28, 2, 3],
      y: [24, 38, 3, 4],
      transition: { duration: flightDuration, delay: d.i * stagger, times: FLIGHT_TIMES, ease: [...FLIGHT_EASE] },
    }),
  };

  // Dérive des feuilles dans l'air, interrompue au rangement.
  const drift: Variants = {
    hidden: { y: 0, rotate: 0 },
    scattered: (d: Doc) => ({
      y: [0, -6, 0],
      rotate: [0, d.i % 2 ? 1.4 : -1.4, 0],
      transition: { duration: 3 + d.i * 0.23, repeat: Infinity, ease: "easeInOut", delay: d.i * 0.1 },
    }),
    ordered: { y: 0, rotate: 0, transition: { duration: 0.35 } },
  };

  const tag: Variants = {
    hidden: { opacity: 0 },
    scattered: { opacity: 0 },
    ordered: (d: Doc) => ({ opacity: 1, transition: { delay: landing(d) + 0.15, duration: 0.3 } }),
  };

  const late = (delay: number): Variants => ({
    hidden: { opacity: 0 },
    scattered: { opacity: 0 },
    ordered: { opacity: 1, transition: { delay, duration: 0.5 } },
  });

  const line = (delay: number): Variants => ({
    hidden: { pathLength: 0, opacity: 0 },
    scattered: { pathLength: 0, opacity: 0 },
    ordered: { pathLength: 1, opacity: 1, transition: { delay, duration: 0.8, ease: "easeInOut" } },
  });

  const folderBump = (f: number): Variants => {
    const landings = docs.filter((d) => d.folder === f).map(landing);
    const total = Math.max(...landings) + 0.4;
    const { values, times } = bumpKeyframes(landings, total);
    return {
      hidden: { y: 0 },
      scattered: { y: 0 },
      ordered: { y: values, transition: { duration: total, times, ease: "easeOut" } },
    };
  };

  const scan = (f: number): Variants => ({
    hidden: { x: -60, opacity: 0 },
    scattered: { x: -60, opacity: 0 },
    ordered: {
      x: [-60, FOLDER_W + 20],
      opacity: [0, 1, 1, 0],
      transition: { delay: settle + 0.55 + f * 0.18, duration: 1.1, ease: "easeInOut", opacity: { times: [0, 0.15, 0.8, 1] } },
    },
  });

  const init = reduce ? false : "hidden";

  return (
    <figure
      ref={ref}
      className="relative mx-auto w-full max-w-[560px]"
      style={{ perspective: 1100 }}
      onPointerMove={(e) => {
        if (!tiltEnabled || reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 12);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * 9);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
    >
      <motion.div style={{ rotateX: srx, rotateY: sry, transformStyle: "preserve-3d" }}>
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
          <defs>
            <filter id="paper-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
            <linearGradient id="paper-grain" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#EEF2EE" />
            </linearGradient>
            <linearGradient id="scan-beam" x1="0" x2="1">
              <stop offset="0" stopColor="#10B981" stopOpacity="0" />
              <stop offset="0.5" stopColor="#10B981" stopOpacity="0.55" />
              <stop offset="1" stopColor="#10B981" stopOpacity="0" />
            </linearGradient>
            {FOLDER_X.map((x) => (
              <clipPath key={x} id={`front-clip-${x}`}>
                <rect x={x} y="304" width={FOLDER_W} height="128" rx="10" />
              </clipPath>
            ))}
          </defs>

          {/* Arborescence du plan de classement */}
          <motion.g initial={init} animate={current} variants={late(settle)}>
            <rect x="180" y="58" width="200" height="46" rx="23" fill="#0E5246" stroke="#10B981" strokeWidth="1.5" />
            <text x="280" y="86" textAnchor="middle" fill="#F8FAF7" fontSize="15" fontWeight="600">
              Plan de classement
            </text>
          </motion.g>
          <g fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round">
            <motion.path d="M280 104 V150" initial={init} animate={current} variants={line(settle + 0.2)} />
            {FOLDER_X.map((x) => (
              <motion.path key={x} d={`M280 150 H${x + 29} V244`} initial={init} animate={current} variants={line(settle + 0.45)} />
            ))}
          </g>

          {/* Dos des dossiers */}
          {FOLDER_X.map((x) => (
            <g key={`back-${x}`}>
              <rect x={x} y="248" width="58" height="26" rx="6" fill="#0E5246" />
              <rect x={x} y="262" width={FOLDER_W} height="170" rx="10" fill="#0E5246" />
            </g>
          ))}

          {/* Feuilles */}
          {docs.map((d) => (
            <g key={d.i} transform={`translate(${d.fx} ${d.fy})`}>
              <motion.g custom={d} variants={flight} initial={init} animate={current} style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}>
                <motion.g custom={d} variants={drift}>
                  <motion.rect
                    custom={d}
                    variants={shadow}
                    width={DOC_W}
                    height={DOC_H}
                    rx="6"
                    fill="#01140F"
                    filter="url(#paper-shadow)"
                  />
                  <rect width={DOC_W} height={DOC_H} rx="6" fill="url(#paper-grain)" stroke="#C3D6CF" />
                  <path d={`M${DOC_W - 18} 0 V14 a4 4 0 0 0 4 4 H${DOC_W}`} fill="#DDE5DF" />
                  <rect x="12" y="24" width="52" height="5" rx="2.5" fill="#B9C8C1" />
                  <rect x="12" y="36" width="60" height="4" rx="2" fill="#DDE5DF" />
                  <rect x="12" y="46" width="44" height="4" rx="2" fill="#DDE5DF" />
                  <rect x="12" y="56" width="56" height="4" rx="2" fill="#DDE5DF" />
                  <rect x="12" y="66" width="38" height="4" rx="2" fill="#DDE5DF" />
                  <motion.rect custom={d} x="12" y="10" width="24" height="6" rx="3" fill="#10B981" variants={tag} />
                </motion.g>
              </motion.g>
            </g>
          ))}

          {/* Façades des dossiers (fléchissent à chaque réception) */}
          {FOLDER_X.map((x, f) => (
            <motion.g key={`front-${x}`} initial={init} animate={current} variants={folderBump(f)}>
              <rect x={x} y="304" width={FOLDER_W} height="128" rx="10" fill="#136456" />
              <rect x={x + 10} y="304" width={FOLDER_W - 20} height="1.5" fill="#10B981" opacity="0.6" />
              <g clipPath={`url(#front-clip-${x})`}>
                <motion.rect variants={scan(f)} x={x} y="304" width="60" height="128" fill="url(#scan-beam)" />
              </g>
              <motion.g variants={late(settle + 0.1 + f * 0.12)}>
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
            </motion.g>
          ))}
        </svg>
      </motion.div>
    </figure>
  );
}
