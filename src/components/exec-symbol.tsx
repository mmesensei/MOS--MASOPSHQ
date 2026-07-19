/**
 * ExecSymbol — Canonical MASOPS executive icons.
 *
 * Each symbol is permanently locked to its executive identity.
 *   IRIS     → 8-pointed compass star   (vision, navigation)
 *   APEX     → hexagonal cube lattice   (structure, systems)
 *   KATANA   → sword through circle     (execution, precision)
 *   SENTINEL → guardian shield          (protection, security)
 *
 * These are inline SVGs — no external assets, no icon library substitutes.
 */

import type { ExecutiveId } from "@/lib/executives";

interface ExecSymbolProps {
  executive: ExecutiveId;
  /** Size in pixels. Default: 20 */
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function ExecSymbol({
  executive,
  size = 20,
  className = "",
  strokeWidth = 1.5,
}: ExecSymbolProps) {
  const shared = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };

  switch (executive) {
    case "iris":
      return <IrisSymbol {...shared} />;
    case "apex":
      return <ApexSymbol {...shared} />;
    case "katana":
      return <KatanaSymbol {...shared} />;
    case "sentinel":
      return <SentinelSymbol {...shared} />;
  }
}

// ─── IRIS — 8-pointed compass star ───────────────────────────────────────────
// Classic navigator's star with 8 equidistant points.
// Outer radius 10, inner radius 3.8 — sharp, precise, directional.
function IrisSymbol(props: React.SVGProps<SVGSVGElement>) {
  // 16 vertices alternating outer (r=10) and inner (r=3.8) at 22.5° steps
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const angle = (i * 22.5 - 90) * (Math.PI / 180);
    const r = i % 2 === 0 ? 10 : 3.8;
    const x = (12 + r * Math.cos(angle)).toFixed(2);
    const y = (12 + r * Math.sin(angle)).toFixed(2);
    pts.push(`${i === 0 ? "M" : "L"}${x},${y}`);
  }
  return (
    <svg {...props}>
      <path d={pts.join(" ") + " Z"} />
      {/* Central crosshair — compass bearing lines */}
      <line x1="12" y1="5" x2="12" y2="19" strokeWidth={(props.strokeWidth as number) * 0.6} strokeOpacity="0.5" />
      <line x1="5" y1="12" x2="19" y2="12" strokeWidth={(props.strokeWidth as number) * 0.6} strokeOpacity="0.5" />
    </svg>
  );
}

// ─── APEX — Hexagonal cube lattice ───────────────────────────────────────────
// Isometric cube wireframe — structure, depth, engineering precision.
function ApexSymbol(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}>
      {/* Outer hexagon */}
      <path d="M12 2 L20.5 6.5 L20.5 17.5 L12 22 L3.5 17.5 L3.5 6.5 Z" />
      {/* Isometric inner edges — suggests 3D cube depth */}
      <line x1="12" y1="2"  x2="12" y2="12" />
      <line x1="20.5" y1="6.5"  x2="12" y2="12" />
      <line x1="3.5"  y1="6.5"  x2="12" y2="12" />
      {/* Bottom cube edges */}
      <line x1="12" y1="12" x2="12"  y2="22" />
      <line x1="12" y1="12" x2="20.5" y2="17.5" />
      <line x1="12" y1="12" x2="3.5"  y2="17.5" />
    </svg>
  );
}

// ─── KATANA — Sword through circle ───────────────────────────────────────────
// A circle bisected by a blade — execution, decisive precision.
function KatanaSymbol(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}>
      {/* Circle */}
      <circle cx="12" cy="12" r="8" />
      {/* Blade — full diagonal through the circle, with a cross-guard */}
      <line x1="4.7" y1="4.7" x2="19.3" y2="19.3" />
      {/* Cross-guard perpendicular to blade */}
      <line x1="7.5" y1="9.8" x2="9.8" y2="7.5" />
      {/* Tip detail */}
      <line x1="19.3" y1="19.3" x2="20.5" y2="21" strokeLinecap="square" />
    </svg>
  );
}

// ─── SENTINEL — Guardian shield ───────────────────────────────────────────────
// Shield with stylized mask/visor — protection, vigilance, not menace.
function SentinelSymbol(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}>
      {/* Shield outline — pointed at base */}
      <path d="M12 2 L20 5.5 L20 12.5 C20 17 16.5 20.5 12 22 C7.5 20.5 4 17 4 12.5 L4 5.5 Z" />
      {/* Visor — two angular eye slits suggesting the guardian mask */}
      <path d="M8 10.5 L10.5 9.5 L12 10 L13.5 9.5 L16 10.5" strokeLinecap="round" />
      <path d="M8 12.5 L10.5 11.5 L12 12 L13.5 11.5 L16 12.5" strokeLinecap="round" />
    </svg>
  );
}
