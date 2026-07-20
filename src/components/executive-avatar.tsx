// ExecutiveAvatar — unified public entry point for all executive presentation.
//
// Every screen that shows an executive must go through this component.
// It selects the appropriate renderer and falls back safely:
//
//   Explicit mode:  live → portrait → 3d → placeholder
//   Auto mode:      live (if liveAssets) → 3d (if modelUrl) → portrait → placeholder
//
// Fallback chain on error:
//   live failure  → portrait
//   3d failure    → portrait
//   portrait fail → placeholder
//   placeholder   → (always renders — no further fallback needed)
//
// Backward-compatible: existing callers (executive state size className) work
// unchanged. The `mode` prop is additive; `portraitSize` enables bust/chip
// portrait variants without breaking callers that pass numeric `size` for 3D.
import { Component, lazy, Suspense, type ReactNode } from "react";
import type { ExecutiveId } from "@/lib/executives";
import { AvatarPlaceholder } from "@/components/avatar/AvatarPlaceholder";
import { PortraitAvatar } from "@/components/avatar/PortraitAvatar";
import { getAvatarConfig } from "@/lib/avatar/config";
import type { AvatarMode, AvatarPresenceInputs, AvatarState, ExecutiveAvatarConfig } from "@/lib/avatar/types";

// Re-export public state type so existing imports keep resolving.
export type { AvatarState } from "@/lib/avatar/types";

// Lazy-load heavy renderers — placeholder and portrait callers never pay.
const AvatarCanvas = lazy(() => import("@/components/avatar/AvatarCanvas"));
const LiveAvatar   = lazy(() => import("@/components/avatar/LiveAvatar").then(m => ({ default: m.LiveAvatar })));

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  executive: ExecutiveId;
  state?: AvatarState;
  /** Pixel size — used for placeholder and 3D modes. Default 64. */
  size?: number;
  className?: string;
  /**
   * Renderer selection. Default "auto".
   * auto → live (if liveAssets) → 3d (if modelUrl) → portrait → placeholder
   */
  mode?: AvatarMode;
  /**
   * Portrait size variant — used in portrait and live modes.
   * "full" → cinematic living scene  |  "bust" → parallax card  |  "chip" → small card
   */
  portraitSize?: "full" | "bust" | "chip";
  /** Optional presence extras (mouthAmp is read from voice-bus automatically). */
  presence?: Partial<AvatarPresenceInputs>;
  /** Allow orbit interaction in 3D mode. */
  interactive?: boolean;
}

// ── Mode resolution ───────────────────────────────────────────────────────────

type ResolvedMode = "placeholder" | "portrait" | "3d" | "live";

function resolveMode(config: ExecutiveAvatarConfig, explicit: AvatarMode): ResolvedMode {
  if (explicit !== "auto") return explicit as ResolvedMode;
  // Auto-detection chain: live → 3d → placeholder.
  // Callers that want portrait must pass mode="portrait" explicitly — this
  // preserves backward compatibility for existing callers that rely on the
  // compact placeholder being returned when no 3D assets are present.
  const hasLiveAssets =
    config.liveAssets != null &&
    Object.values(config.liveAssets).some((v) => typeof v === "string" && v.length > 0);
  if (hasLiveAssets) return "live";
  if (config.modelUrl) return "3d";
  return "placeholder";
}

// ── Generic error boundary ────────────────────────────────────────────────────

interface EBState { caught: boolean }

class AvatarErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, EBState> {
  state: EBState = { caught: false };
  static getDerivedStateFromError(): EBState { return { caught: true }; }
  render() { return this.state.caught ? this.props.fallback : this.props.children; }
}

// ── Main component ────────────────────────────────────────────────────────────

export function ExecutiveAvatar({
  executive,
  state = "idle",
  size = 64,
  className,
  mode = "auto",
  portraitSize = "full",
  presence,
  interactive,
}: Props) {
  const config = getAvatarConfig(executive);
  const resolved = resolveMode(config, mode);

  // Shared inputs for 3D renderer
  const inputs: AvatarPresenceInputs = {
    state,
    emotion: presence?.emotion ?? "neutral",
    available: presence?.available ?? true,
    loading: presence?.loading ?? false,
    mouthAmp: presence?.mouthAmp,
  };

  // Portrait fallback used by live and 3d error boundaries
  const portraitFallback = (
    <PortraitAvatar
      executive={executive}
      state={state}
      size={portraitSize}
      className={className}
      overlayCalibration={config.presentation?.overlayCalibration}
    />
  );

  // Placeholder fallback (terminal — always renders)
  const placeholderFallback = (
    <AvatarPlaceholder
      executive={executive}
      state={state}
      size={size}
      className={className}
    />
  );

  // ── Placeholder mode ──────────────────────────────────────────────────────
  if (resolved === "placeholder") {
    return placeholderFallback;
  }

  // ── Portrait mode ─────────────────────────────────────────────────────────
  if (resolved === "portrait") {
    return (
      <AvatarErrorBoundary fallback={placeholderFallback}>
        {portraitFallback}
      </AvatarErrorBoundary>
    );
  }

  // ── Live mode ─────────────────────────────────────────────────────────────
  if (resolved === "live" && config.liveAssets) {
    return (
      <AvatarErrorBoundary fallback={portraitFallback}>
        <Suspense fallback={portraitFallback}>
          <LiveAvatar
            executive={executive}
            state={state}
            liveAssets={config.liveAssets}
            size={portraitSize}
            className={className}
          />
        </Suspense>
      </AvatarErrorBoundary>
    );
  }

  // ── 3D mode ───────────────────────────────────────────────────────────────
  // (also the fall-through when live mode was selected but liveAssets is null)
  return (
    <AvatarErrorBoundary fallback={portraitFallback}>
      <div className={className} style={{ width: size, height: size }}>
        <Suspense
          fallback={
            <AvatarPlaceholder
              executive={executive}
              state={state}
              size={size}
            />
          }
        >
          <AvatarCanvas
            config={config}
            inputs={inputs}
            size={size}
            interactive={interactive}
          />
        </Suspense>
      </div>
    </AvatarErrorBoundary>
  );
}
