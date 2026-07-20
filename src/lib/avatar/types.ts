// Executive Avatar Framework — shared types.
//
// The avatar layer is PRESENTATION ONLY. No operational logic lives here.
// State/availability/speaking are inputs; the framework maps them to visual
// output (portrait today, GLB models and live video when assets are supplied)
// without callers caring which renderer is active.

import type { ExecutiveId } from "@/lib/executives";

/**
 * Public state union — extended to cover the full production lifecycle.
 * Legacy states (`idle`/`listening`/`thinking`/`speaking`/`reviewing`/
 * `warning`) are preserved so every existing caller keeps working.
 * New states are additive and safe to opt into.
 */
export type AvatarState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "reviewing"
  | "warning"
  | "working"
  | "celebrating"
  | "offline";

/** Extended emotional/affect state — reserved for future 3D face rigs. */
export type AvatarEmotion =
  | "neutral"
  | "focused"
  | "concerned"
  | "confident"
  | "curious"
  | "pleased";

/**
 * Renderer selection.
 *
 * "auto"        — live (if asset) → 3d (if modelUrl) → portrait → placeholder
 * "placeholder" — always the 2D SVG silhouette (zero cost)
 * "portrait"    — 2D parallax portrait card (bust/chip) or R3F living scene (full)
 * "3d"          — GLB/GLTF model via AvatarCanvas (requires modelUrl)
 * "live"        — video clips from /public/assets/executives/<id>/live/
 */
export type AvatarMode = "auto" | "placeholder" | "portrait" | "3d" | "live";

/** Camera presets for future cinematic scenes (boardroom, HQ, holo). */
export type CameraPreset = "portrait" | "bust" | "wide" | "cinematic";

/** Lighting rigs — mapped per executive identity. */
export type LightingPreset =
  | "studio"
  | "command"
  | "warroom"
  | "sanctum"
  | "vault";

/** Voice profile placeholder — real bindings live in exec-voices/TTS. */
export interface VoiceProfileRef {
  /** Stable ID linking to ElevenLabs / provider mapping downstream. */
  voiceId: string;
  /**
   * Reserved for viseme/blendshape target mapping. Keys are viseme codes
   * (e.g. "AA", "EE", "OH"); values are morph-target names on the GLB.
   */
  visemeMap?: Record<string, string>;
  /** Reserved for emotional transition curves (future TTS SSML). */
  emotionCurves?: Partial<Record<AvatarEmotion, string>>;
}

/**
 * Animation clip references. Names are conventional GLB clip names — swap
 * without touching component code by editing the executive's config entry.
 */
export interface AnimationProfile {
  idle: string;
  speaking: string;
  thinking?: string;
  listening?: string;
  reviewing?: string;
  warning?: string;
  working?: string;
  celebrating?: string;
  greeting?: string;
  offline?: string;
  gestures?: Record<string, string>;
}

/**
 * Design canon — the immutable visual identity for each executive.
 * Sourced from the FD-003B founder directive artwork.
 */
export interface DesignCanon {
  role: string;
  visualIdentity: readonly string[];
  personality: readonly string[];
  environment: string;
}

/** Reserved slot for future Headquarters scene composition. */
export interface SpatialConfig {
  homePosition: [number, number, number];
  interactionRadius: number;
  waypoints?: Record<string, [number, number, number]>;
}

/**
 * Live video asset paths for the "live" renderer.
 * Place .webm files (with .mp4 fallback) at:
 *   /public/assets/executives/<id>/live/<clip>.webm
 *
 * All fields are optional — the renderer falls back gracefully when absent.
 */
export interface LiveAssets {
  /** Static poster shown before video loads / in reduced-motion mode. */
  poster?: string;
  idle?: string;
  listening?: string;
  thinking?: string;
  speaking?: string;
  reviewing?: string;
  working?: string;
  warning?: string;
  celebrating?: string;
  offline?: string;
}

/**
 * Per-executive overlay calibration for the portrait renderer.
 * Override the default fixed-position eye/mouth overlays to match each
 * executive's actual portrait crop. All values are CSS strings (e.g. "28%").
 * Omit an overlay entirely to disable it for this executive.
 */
export interface OverlayCalibration {
  /** Blink veil — horizontal band across the eye line. */
  eyes?: { top: string; left: string; width: string } | null;
  /** Speaking mouth indicator. */
  mouth?: { top: string; left: string; width: string } | null;
}

/**
 * Presentation calibration — per-executive positioning and overlay tuning.
 * Values here centralise all the "magic numbers" that were previously
 * scattered through individual route components.
 */
export interface PresentationConfig {
  // 3D model transform (applied to the cloned GLB scene root)
  modelScale?: number;
  modelPosition?: [number, number, number];
  modelRotation?: [number, number, number];
  // 3D camera override (falls back to CameraPreset defaults)
  cameraPosition?: [number, number, number];
  cameraTarget?: [number, number, number];
  // Portrait object-position CSS hint (e.g. "center top")
  portraitObjectPosition?: string;
  // Overlay calibration for the portrait renderer
  overlayCalibration?: OverlayCalibration;
}

/** Per-executive avatar configuration. One entry drives every renderer. */
export interface ExecutiveAvatarConfig {
  executive: ExecutiveId;
  /** GLB/GLTF path. null → no 3D. Drop model in, wire path. */
  modelUrl: string | null;
  /** Optional lower-fidelity preview used while the full model streams. */
  previewUrl?: string | null;
  animations: AnimationProfile;
  voice: VoiceProfileRef;
  camera: CameraPreset;
  lighting: LightingPreset;
  /** Signature identity color token (hsl var name). */
  colorToken: string;
  /** Optional bounding scale for varying model sizes. */
  modelScale?: number;
  /** Design canon — the founder-directive visual identity. */
  canon: DesignCanon;
  /** Reserved: Headquarters spatial config. */
  spatial?: SpatialConfig;
  /** Root folder for auxiliary animation clips (drop-in workflow). */
  assetRoot: string;
  /**
   * Live video assets. null → live mode falls back to portrait.
   * Populate when executive video clips are supplied.
   */
  liveAssets: LiveAssets | null;
  /**
   * Per-executive presentation calibration — model positioning, camera
   * overrides, portrait crop hints, and overlay tuning.
   */
  presentation?: PresentationConfig;
}

/** Runtime inputs the avatar reacts to. Composed by callers. */
export interface AvatarPresenceInputs {
  state: AvatarState;
  emotion?: AvatarEmotion;
  /** 0..1 mouth amplitude for lip-sync (fed by TTS pipeline). */
  mouthAmp?: number;
  /** Availability gate — dims the avatar when offline. */
  available?: boolean;
  /** True while an async op is loading (spinner overlay). */
  loading?: boolean;
  /**
   * Optional attention target (client px). Future 3D rigs will turn the
   * head toward this point; ignored by the placeholder.
   */
  attentionTarget?: { x: number; y: number } | null;
}
