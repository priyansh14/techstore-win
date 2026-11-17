import { useId, type ReactNode } from "react";

interface Props {
  slug: string;
  label: string;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Hand-built SVG product art. No external images: nothing to fail, nothing extra in the waterfall.
 * Every illustration is drawn on a 320×200 canvas and scales responsively.
 */
export function ProductIllustration({ slug, label, width = 320, height = 200, className }: Props) {
  const uid = useId().replace(/:/g, "");
  const g = (name: string) => `${name}-${uid}`;
  const art = ART[slug] ?? ART.default;
  return (
    <svg
      viewBox="0 0 320 200"
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className={className}
      style={{ maxWidth: "100%", height: "auto" }}
      data-testid={`illustration-${slug}`}
    >
      <title>{label}</title>
      <defs>
        <linearGradient id={g("bg")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#EEF2FF" />
          <stop offset="1" stopColor="#F8FAFC" />
        </linearGradient>
        <linearGradient id={g("metal")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F1F5F9" />
          <stop offset="1" stopColor="#CBD5E1" />
        </linearGradient>
        <linearGradient id={g("dark")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#334155" />
          <stop offset="1" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id={g("accent")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#818CF8" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
        <linearGradient id={g("screen")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#312E81" />
          <stop offset="0.55" stopColor="#4F46E5" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <radialGradient id={g("glow")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#818CF8" stopOpacity="0.45" />
          <stop offset="1" stopColor="#818CF8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${g("bg")})`} />
      <g opacity="0.5" stroke="#E0E7FF" strokeWidth="1">
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="200" />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 50} x2="320" y2={i * 50} />
        ))}
      </g>
      <ellipse cx="160" cy="100" rx="120" ry="80" fill={`url(#${g("glow")})`} />
      <ellipse cx="160" cy="170" rx="96" ry="9" fill="#0F172A" opacity="0.08" />
      {art(g)}
    </svg>
  );
}

type Art = (g: (n: string) => string) => ReactNode;

const signal = (cx: number, cy: number, color = "#4F46E5") => (
  <g fill="none" stroke={color} strokeLinecap="round" strokeWidth="3">
    <path d={`M${cx - 10} ${cy} a 10 10 0 0 1 20 0`} opacity="0.9" />
    <path d={`M${cx - 20} ${cy} a 20 20 0 0 1 40 0`} opacity="0.6" />
    <path d={`M${cx - 30} ${cy} a 30 30 0 0 1 60 0`} opacity="0.3" />
  </g>
);

const router = (g: (n: string) => string, scale: number, label: string): ReactNode => (
  <g transform={`translate(160 120) scale(${scale}) translate(-160 -120)`}>
    <rect x="113" y="54" width="6" height="58" rx="3" fill={`url(#${g("dark")})`} />
    <rect x="201" y="54" width="6" height="58" rx="3" fill={`url(#${g("dark")})`} />
    <rect x="96" y="100" width="128" height="62" rx="16" fill={`url(#${g("dark")})`} />
    <rect x="96" y="100" width="128" height="10" rx="5" fill="#475569" opacity="0.5" />
    {[0, 1, 2, 3, 4].map((i) => (
      <circle key={i} cx={122 + i * 12} cy="140" r="3" fill={i < 4 ? "#34D399" : "#818CF8"} />
    ))}
    <text x="200" y="144" textAnchor="middle" fontSize="11" fontWeight="700" fill="#C7D2FE" fontFamily="ui-sans-serif, system-ui">
      {label}
    </text>
    {signal(160, 84)}
  </g>
);

const ART: Record<string, Art> = {
  "fiber-1g": (g) => (
    <>
      <path d="M20 150 C 70 150, 70 128, 100 128" stroke={`url(#${g("accent")})`} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M20 160 C 70 160, 80 136, 100 136" stroke="#22D3EE" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.8" />
      {router(g, 1.05, "1G")}
    </>
  ),
  "fiber-300m": (g) => (
    <>
      <path d="M24 152 C 74 152, 78 134, 104 134" stroke={`url(#${g("accent")})`} strokeWidth="3" fill="none" strokeLinecap="round" />
      {router(g, 0.88, "300")}
    </>
  ),
  "biz-2g": (g) => (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="82" y={54 + i * 36} width="156" height="30" rx="6" fill={`url(#${g("dark")})`} />
          {[0, 1, 2, 3, 4, 5].map((p) => (
            <rect key={p} x={96 + p * 14} y={64 + i * 36} width="9" height="10" rx="2" fill="#1E293B" stroke="#475569" />
          ))}
          <circle cx="198" cy={69 + i * 36} r="3" fill={i === 1 ? "#FBBF24" : "#34D399"} />
          <circle cx="210" cy={69 + i * 36} r="3" fill="#818CF8" />
          <rect x="220" y={64 + i * 36} width="10" height="10" rx="2" fill="#4F46E5" />
        </g>
      ))}
      <path d="M238 69 C 270 69, 268 40, 300 40" stroke="#22D3EE" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M238 105 C 276 105, 270 70, 304 70" stroke={`url(#${g("accent")})`} strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="40" y="30" width="56" height="20" rx="10" fill="#0F172A" />
      <text x="68" y="44" textAnchor="middle" fontSize="10" fontWeight="700" fill="#A5B4FC" fontFamily="ui-sans-serif, system-ui">
        99.95%
      </text>
    </>
  ),
  "backup-5g": (g) => (
    <>
      <rect x="118" y="62" width="84" height="104" rx="18" fill={`url(#${g("metal")})`} stroke="#CBD5E1" />
      <rect x="130" y="76" width="60" height="34" rx="8" fill={`url(#${g("dark")})`} />
      <text x="160" y="99" textAnchor="middle" fontSize="16" fontWeight="800" fill="#A5B4FC" fontFamily="ui-sans-serif, system-ui">
        5G
      </text>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={138 + i * 12} y={148 - i * 8} width="7" height={8 + i * 8} rx="2" fill={i < 3 ? "#4F46E5" : "#A5B4FC"} />
      ))}
      <circle cx="146" cy="124" r="3" fill="#34D399" />
      <circle cx="158" cy="124" r="3" fill="#34D399" />
      {signal(160, 50)}
      <path d="M64 132 h40" stroke="#94A3B8" strokeWidth="3" strokeDasharray="4 6" strokeLinecap="round" />
      <path d="M216 132 h40" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round" />
      <path d="M250 126 l8 6 -8 6" stroke="#4F46E5" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  "studiobook-14": (g) => (
    <>
      <rect x="86" y="38" width="148" height="100" rx="8" fill={`url(#${g("dark")})`} />
      <rect x="93" y="45" width="134" height="86" rx="4" fill={`url(#${g("screen")})`} />
      <path d="M93 110 C 130 80, 170 120, 227 70 V131 H93Z" fill="#fff" opacity="0.08" />
      <circle cx="160" cy="41.5" r="1.5" fill="#64748B" />
      <path d="M64 140 H256 L244 156 H76 Z" fill={`url(#${g("metal")})`} stroke="#CBD5E1" />
      <rect x="140" y="140" width="40" height="4" rx="2" fill="#94A3B8" />
    </>
  ),
  "aero-anc": (g) => (
    <>
      <path d="M104 118 V96 a56 56 0 0 1 112 0 V118" fill="none" stroke={`url(#${g("dark")})`} strokeWidth="12" strokeLinecap="round" />
      <path d="M104 96 a56 56 0 0 1 112 0" fill="none" stroke="#475569" strokeWidth="3" opacity="0.6" />
      <rect x="82" y="104" width="44" height="64" rx="20" fill={`url(#${g("dark")})`} />
      <rect x="194" y="104" width="44" height="64" rx="20" fill={`url(#${g("dark")})`} />
      <rect x="90" y="114" width="28" height="44" rx="14" fill="#1E293B" stroke="#4F46E5" strokeWidth="2" />
      <rect x="202" y="114" width="28" height="44" rx="14" fill="#1E293B" stroke="#4F46E5" strokeWidth="2" />
      <g stroke="#818CF8" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8">
        <path d="M252 120 q8 16 0 32" />
        <path d="M262 112 q14 24 0 48" opacity="0.5" />
        <path d="M68 120 q-8 16 0 32" />
        <path d="M58 112 q-14 24 0 48" opacity="0.5" />
      </g>
    </>
  ),
  "dockone-hub": (g) => (
    <>
      <rect x="62" y="96" width="196" height="54" rx="14" fill={`url(#${g("metal")})`} stroke="#CBD5E1" />
      <rect x="62" y="138" width="196" height="12" rx="6" fill="#94A3B8" opacity="0.4" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={82 + i * 22} y="114" width={i < 2 ? 14 : 12} height={i < 2 ? 8 : 6} rx="3" fill="#0F172A" />
      ))}
      <rect x="220" y="112" width="20" height="12" rx="2" fill="#0F172A" />
      <circle cx="248" cy="104" r="2.5" fill="#4F46E5" />
      <path d="M160 96 C 160 60, 214 70, 230 38" stroke={`url(#${g("dark")})`} strokeWidth="5" fill="none" strokeLinecap="round" />
      <rect x="224" y="26" width="16" height="16" rx="4" fill="#4F46E5" />
      <path d="M229 34 l3 -4 v3 h3 l-3 4 v-3 z" fill="#fff" />
    </>
  ),
  "wifi7-mesh": (g) => (
    <>
      {[
        [96, 118, 0.85],
        [160, 104, 1],
        [224, 118, 0.85],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <rect x="-26" y="-34" width="52" height="68" rx="20" fill={`url(#${g("metal")})`} stroke="#CBD5E1" />
          <rect x="-14" y="-24" width="28" height="4" rx="2" fill="#4F46E5" opacity="0.8" />
          <circle cx="0" cy="22" r="3" fill="#34D399" />
        </g>
      ))}
      <g stroke="#818CF8" strokeWidth="2" strokeDasharray="3 5" fill="none">
        <path d="M118 96 Q 128 72 140 82" />
        <path d="M180 82 Q 192 72 202 96" />
      </g>
      {signal(160, 60)}
    </>
  ),
  default: (g) => <rect x="110" y="60" width="100" height="100" rx="20" fill={`url(#${g("accent")})`} />,
};
