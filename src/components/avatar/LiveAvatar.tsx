// LiveAvatar — video-based executive renderer.
//
// Reads clip paths from the executive's liveAssets config. Falls back to
// PortraitAvatar when assets are absent, on error, or under reduced motion.
//
// Expected asset layout (drop clips here to activate):
//   /public/assets/executives/<id>/live/idle.webm      (+ .mp4 fallback)
//   /public/assets/executives/<id>/live/speaking.webm
//   /public/assets/executives/<id>/live/thinking.webm
//   … (see LiveAssets type for full list)
//
// Playback rules:
//   - muted autoplay, playsInline, no native controls
//   - preload="metadata" only (no network waste)
//   - loops on idle; state clips play through then loop back to idle
//   - pauses when the element scrolls off-screen (IntersectionObserver)
//   - pauses when the browser tab is hidden (visibilitychange)
//   - reduced-motion: shows poster still image, no video
//   - error → falls back to PortraitAvatar
//   - no audio path: TTS/voice output remains separate from video
import { useEffect, useRef, useState } from "react";
import type { ExecutiveId } from "@/lib/executives";
import type { AvatarState, LiveAssets } from "@/lib/avatar/types";
import { PortraitAvatar } from "@/components/avatar/PortraitAvatar";

interface Props {
  executive: ExecutiveId;
  state?: AvatarState;
  liveAssets: LiveAssets;
  size?: "full" | "bust" | "chip";
  className?: string;
}

type ClipKey = keyof Omit<LiveAssets, "poster">;

function stateToClipKey(state: AvatarState): ClipKey {
  const map: Partial<Record<AvatarState, ClipKey>> = {
    listening:   "listening",
    thinking:    "thinking",
    speaking:    "speaking",
    reviewing:   "reviewing",
    working:     "working",
    warning:     "warning",
    celebrating: "celebrating",
    offline:     "offline",
  };
  return map[state] ?? "idle";
}

export function LiveAvatar({ executive, state = "idle", liveAssets, size = "full", className }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  // Stable reduced-motion check (read once on mount — never changes mid-session)
  const [reducedMotion] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  const clipKey = stateToClipKey(state);
  const clipUrl = liveAssets[clipKey] ?? liveAssets.idle ?? null;

  // ── Fall-through conditions ───────────────────────────────────────────────
  if (!clipUrl || error || reducedMotion) {
    return (
      <PortraitAvatar
        executive={executive}
        state={state}
        size={size}
        className={className}
      />
    );
  }

  return (
    <LiveVideoPlayer
      executive={executive}
      state={state}
      size={size}
      className={className}
      clipUrl={clipUrl}
      poster={liveAssets.poster}
      videoRef={videoRef}
      onError={() => setError(true)}
    />
  );
}

// Split into a sub-component so hooks run unconditionally (rules of hooks).
interface PlayerProps {
  executive: ExecutiveId;
  state: AvatarState;
  size: "full" | "bust" | "chip";
  className?: string;
  clipUrl: string;
  poster?: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onError: () => void;
}

function LiveVideoPlayer({ executive, state, size, className, clipUrl, poster, videoRef, onError }: PlayerProps) {
  const prevClipUrl = useRef<string | null>(null);

  // ── Swap clip when state changes ─────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || clipUrl === prevClipUrl.current) return;
    prevClipUrl.current = clipUrl;
    video.src = clipUrl;
    video.load();
    video.play().catch(() => {
      // Autoplay blocked (common on mobile) — video shows poster, not an error
    });
  }, [clipUrl, videoRef]);

  // ── Pause when tab is hidden ──────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onVisibility = () => {
      if (document.hidden) {
        video.pause();
      } else {
        video.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [videoRef]);

  // ── Pause when scrolled off-screen ────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, [videoRef]);

  const dims =
    size === "full"
      ? "aspect-[7/12] w-full max-w-[420px]"
      : size === "bust"
        ? "aspect-square w-full max-w-[220px]"
        : "h-16 w-16";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${dims} ${className ?? ""}`}
      aria-label={`${executive.toUpperCase()} — live presentation`}
    >
      <video
        ref={videoRef}
        src={clipUrl}
        poster={poster}
        muted
        autoPlay
        playsInline
        loop
        preload="metadata"
        className="h-full w-full object-cover object-top"
        onError={onError}
        aria-hidden="true"
      />
      {/* Bottom vignette for visual continuity with portrait mode */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
      {/* State label */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-background/70 px-2 py-1 backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-primary status-live" />
        <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
          {state}
        </span>
      </div>
    </div>
  );
}
