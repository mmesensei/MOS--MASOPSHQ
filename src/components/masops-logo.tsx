/**
 * MasopsLogo — Canonical MASOPS shield + star mark.
 *
 * Matches the official brand reference: gold shield with an internal
 * 8-pointed star, "MASOPS" wordmark, optional subtitle.
 * Never replaced with a gradient div or generic icon.
 */

interface MasopsLogoProps {
  /** Show only the shield mark, without text */
  markOnly?: boolean;
  /** Show the full subtitle "MASTERMIND OPERATIONS SYSTEM" */
  subtitle?: boolean;
  /** Shield size in pixels. Default 24. */
  size?: number;
  className?: string;
}

export function MasopsLogo({
  markOnly = false,
  subtitle = false,
  size = 24,
  className = "",
}: MasopsLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <MasopsShieldMark size={size} />
      {!markOnly && (
        <div className="flex flex-col leading-none">
          <span
            className="font-display font-bold tracking-[0.15em] text-foreground"
            style={{ fontSize: size * 0.54 }}
          >
            MASOPS
          </span>
          {subtitle && (
            <span
              className="mt-0.5 font-mono uppercase tracking-[0.18em] text-gold/70"
              style={{ fontSize: size * 0.28 }}
            >
              Mastermind Operations System
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Standalone gold shield + star mark — use wherever the logo icon alone is needed */
export function MasopsShieldMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="MASOPS shield"
    >
      {/* Shield body */}
      <path
        d="M16 2 L28 6.5 L28 17 C28 23.5 22.5 28.5 16 30 C9.5 28.5 4 23.5 4 17 L4 6.5 Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="text-gold"
      />
      {/* Inner 8-pointed compass star */}
      <path
        d={buildStarPath(16, 16.5, 8.5, 3.2, 8)}
        fill="currentColor"
        className="text-gold"
      />
    </svg>
  );
}

/** Build an n-pointed star SVG path string centered at (cx, cy) */
function buildStarPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points: number,
): string {
  const total = points * 2;
  const pts: string[] = [];
  for (let i = 0; i < total; i++) {
    const angle = (i * (360 / total) - 90) * (Math.PI / 180);
    const r = i % 2 === 0 ? outerR : innerR;
    const x = (cx + r * Math.cos(angle)).toFixed(3);
    const y = (cy + r * Math.sin(angle)).toFixed(3);
    pts.push(`${i === 0 ? "M" : "L"}${x},${y}`);
  }
  return pts.join(" ") + " Z";
}
