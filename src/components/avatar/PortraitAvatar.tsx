// PortraitAvatar — internal portrait renderer used by ExecutiveAvatar.
//
// Routes portrait rendering to the appropriate sub-system based on size:
//   "full"  → R3F ExecutiveLivingScene (cinematic, lazy/client-only)
//   "bust"  → ExecutivePresence (2D parallax portrait card)
//   "chip"  → ExecutivePresence (2D portrait chip)
//
// Callers should go through ExecutiveAvatar, not this component directly.
// ExecutivePresence remains available as a standalone import for backward
// compatibility with existing callers not yet migrated.
import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { ExecutivePresence, type PresenceState } from "@/components/executive-presence";
import type { ExecutiveId } from "@/lib/executives";
import type { AvatarState, OverlayCalibration } from "@/lib/avatar/types";

const LazyLivingScene = lazy(() => import("@/components/executive-living-scene"));

/** Map extended AvatarState values to PresenceState for 2D portrait renderers. */
export function toPresenceState(state: AvatarState): PresenceState {
  switch (state) {
    case "warning":     return "reviewing";
    case "working":     return "thinking";
    case "celebrating": return "speaking";
    case "offline":     return "idle";
    default:            return state as PresenceState;
  }
}

interface Props {
  executive: ExecutiveId;
  state?: AvatarState;
  size?: "full" | "bust" | "chip";
  className?: string;
  /**
   * Per-executive overlay calibration from config.
   * Currently accepted but forwarded via context when portrait 2D renders.
   * The living scene handles its own overlays in 3D space.
   * Future: wire into ExecutivePresence for tuned blink/mouth positions.
   */
  overlayCalibration?: OverlayCalibration;
}

export function PortraitAvatar({ executive, state = "idle", size = "full", className, overlayCalibration: _overlayCalibration }: Props) {
  const presenceState = toPresenceState(state);

  if (size === "full") {
    // Full size: render the cinematic R3F living scene (browser-only).
    // The living scene subscribes to the presence bus internally, so state
    // doesn't need to be passed — it's picked up from the same hook chain.
    const fallback = (
      <ExecutivePresence
        executive={executive}
        state={presenceState}
        size="full"
        className={className}
      />
    );
    return (
      <ClientOnly fallback={fallback}>
        <Suspense fallback={fallback}>
          <LazyLivingScene executive={executive} className={className} />
        </Suspense>
      </ClientOnly>
    );
  }

  // Bust / chip: 2D parallax portrait card.
  return (
    <ExecutivePresence
      executive={executive}
      state={presenceState}
      size={size}
      className={className}
    />
  );
}
