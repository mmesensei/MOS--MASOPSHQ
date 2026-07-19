// Executive Avatar — unified entry point for the whole app.
//
// Backward-compatible: existing callers (`<ExecutiveAvatar executive state
// size className />`) keep working unchanged. Under the hood, this reads
// the per-executive config from the framework and renders either the 2D
// placeholder (default, zero 3D cost) or the R3F canvas (when a model is
// configured, or when the caller explicitly opts in with mode="3d").
//
// Presentation only — no operational logic lives here.
import { lazy, Suspense } from "react";
import type { ExecutiveId } from "@/lib/executives";
import { AvatarPlaceholder } from "@/components/avatar/AvatarPlaceholder";
import { getAvatarConfig } from "@/lib/avatar/config";
import type { AvatarMode, AvatarPresenceInputs, AvatarState } from "@/lib/avatar/types";

// Re-export the public state type so existing imports keep resolving.
export type { AvatarState } from "@/lib/avatar/types";

// Lazy-load the 3D canvas: placeholder callers never pay for Three.
const AvatarCanvas = lazy(() => import("@/components/avatar/AvatarCanvas"));

interface Props {
  executive: ExecutiveId;
  state?: AvatarState;
  size?: number;
  className?: string;
  /** Renderer override. Default "auto": 3D if modelUrl present, else placeholder. */
  mode?: AvatarMode;
  /** Optional presence extras (mouth amp is read from voice-bus automatically). */
  presence?: Partial<AvatarPresenceInputs>;
  /** Allow orbit interaction in 3D mode (HQ / boardroom scenes). */
  interactive?: boolean;
}

export function ExecutiveAvatar({
  executive,
  state = "idle",
  size = 64,
  className,
  mode = "auto",
  presence,
  interactive,
}: Props) {
  const config = getAvatarConfig(executive);
  const resolvedMode: AvatarMode =
    mode === "auto" ? (config.modelUrl ? "3d" : "placeholder") : mode;

  if (resolvedMode === "placeholder") {
    return <AvatarPlaceholder executive={executive} state={state} size={size} className={className} />;
  }

  const inputs: AvatarPresenceInputs = {
    state,
    emotion: presence?.emotion ?? "neutral",
    available: presence?.available ?? true,
    loading: presence?.loading ?? false,
    mouthAmp: presence?.mouthAmp,
  };

  return (
    <div className={className} style={{ width: size, height: size }}>
      <Suspense
        fallback={<AvatarPlaceholder executive={executive} state={state} size={size} />}
      >
        <AvatarCanvas config={config} inputs={inputs} size={size} interactive={interactive} />
      </Suspense>
    </div>
  );
}
