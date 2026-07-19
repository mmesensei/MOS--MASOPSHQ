// 2D placeholder renderer — the legacy signature-silhouette avatar.
// Used when a config has no `modelUrl`, and as a graceful fallback while
// GLB assets stream / on WebGL failure. Preserves the original visual
// language 1:1 so nothing regresses when the framework is introduced.
import { cn } from "@/lib/utils";
import type { ExecutiveId } from "@/lib/executives";
import type { AvatarState } from "@/lib/avatar/types";

interface Props {
  executive: ExecutiveId;
  state?: AvatarState;
  size?: number;
  className?: string;
}

const GLYPH: Record<ExecutiveId, React.ReactNode> = {
  iris: (
    <path
      d="M32 8 L36 28 L56 32 L36 36 L32 56 L28 36 L8 32 L28 28 Z"
      fill="currentColor"
      fillOpacity="0.9"
    />
  ),
  apex: (
    <path
      d="M32 10 L52 22 L52 42 L32 54 L12 42 L12 22 Z M32 20 L42 26 L42 38 L32 44 L22 38 L22 26 Z"
      fill="currentColor"
      fillOpacity="0.9"
      fillRule="evenodd"
    />
  ),
  katana: (
    <g fill="currentColor" fillOpacity="0.9">
      <path d="M14 50 L44 20 L48 24 L18 54 Z" />
      <circle cx="46" cy="22" r="3" />
    </g>
  ),
  sentinel: (
    <path
      d="M32 8 L52 16 L52 34 C52 46 42 54 32 58 C22 54 12 46 12 34 L12 16 Z M32 22 L32 44 M22 33 L42 33"
      fill="currentColor"
      fillOpacity="0.15"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  ),
};

const COLOR: Record<ExecutiveId, string> = {
  iris: "text-iris",
  apex: "text-apex",
  katana: "text-katana",
  sentinel: "text-sentinel",
};

const RING_BG: Record<ExecutiveId, string> = {
  iris: "from-iris/25 via-iris/5 to-transparent",
  apex: "from-apex/25 via-apex/5 to-transparent",
  katana: "from-katana/25 via-katana/5 to-transparent",
  sentinel: "from-sentinel/25 via-sentinel/5 to-transparent",
};

const STATE_LABEL: Record<AvatarState, string> = {
  idle: "Standing by",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  reviewing: "Reviewing",
  warning: "Advising caution",
  working: "Working",
  celebrating: "Celebrating",
  offline: "Offline",
};

export function AvatarPlaceholder({ executive, state = "idle", size = 64, className }: Props) {
  const active = state !== "idle";
  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-label={`${executive.toUpperCase()} — ${STATE_LABEL[state]}`}
      role="img"
    >
      <div
        className={cn(
          "absolute inset-0 rounded-full bg-gradient-to-br",
          RING_BG[executive],
          "avatar-breath",
        )}
      />
      <div
        className={cn(
          "absolute inset-[10%] rounded-full border",
          "border-border-strong bg-surface-raised/80 backdrop-blur-sm",
          active && `exec-glow-${executive}`,
        )}
      />
      <svg
        viewBox="0 0 64 64"
        className={cn("relative z-10", COLOR[executive], state === "thinking" && "avatar-tilt")}
        style={{ width: size * 0.55, height: size * 0.55 }}
      >
        {GLYPH[executive]}
      </svg>
      <span
        className={cn(
          "absolute bottom-[6%] right-[6%] z-20 h-2.5 w-2.5 rounded-full border border-background",
          state === "warning"
            ? "bg-destructive"
            : state === "speaking" || state === "thinking"
              ? "bg-primary"
              : "bg-sentinel",
          state !== "idle" ? "status-live" : "opacity-70",
        )}
      />
    </div>
  );
}
