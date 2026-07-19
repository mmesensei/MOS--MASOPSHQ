// Executive Avatar Framework — shared types.
//
// The avatar layer is PRESENTATION ONLY. No operational logic lives here.
// State/availability/speaking are inputs; the framework maps them to visual
// output (2D placeholder today, GLB models tomorrow) without callers caring
// which renderer is active.

import type { ExecutiveId } from "@/lib/executives";

/**
 * Public state union — extended in FD-003B to cover the full production
 * lifecycle. Legacy states (`idle`/`listening`/`thinking`/`speaking`/
 * `reviewing`/`warning`) are preserved so every existing caller keeps
 * working. New states are additive and safe to opt into.
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

/** Which renderer to use. "auto" picks 3D when a model is configured. */
export type AvatarMode = "auto" | "placeholder" | "3d";

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
 * Any additional `.glb` files dropped into the executive's asset folder can
 * be referenced here (e.g. `gestures: { nod: "Nod", point: "Point" }`).
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
 * Sourced from the FD-003B founder directive artwork. Future 3D models
 * MUST match this canon; downstream tools (model pipeline, marketing,
 * HQ scene) can read it to stay in sync.
 */
export interface DesignCanon {
  /** Short title shown in briefing surfaces. */
  role: string;
  /** Visual descriptors (silhouette, attire, palette hints). */
  visualIdentity: readonly string[];
  /** Personality descriptors (behavior, tone). */
  personality: readonly string[];
  /** Environment / setting the executive is canonically framed in. */
  environment: string;
}

/**
 * Reserved slot for future Headquarters scene composition. Optional today;
 * populated by the HQ scene planner when multi-avatar scenes ship.
 */
export interface SpatialConfig {
  /** Default position within an HQ scene (metres). */
  homePosition: [number, number, number];
  /** Interaction radius — used by proximity/hover triggers. */
  interactionRadius: number;
  /** Named waypoints the executive can walk to. */
  waypoints?: Record<string, [number, number, number]>;
}

/** Per-executive avatar configuration. One entry drives every renderer. */
export interface ExecutiveAvatarConfig {
  executive: ExecutiveId;
  /** GLB/GLTF path. null → placeholder renderer. Drop model in, wire path. */
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
