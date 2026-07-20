// Executive Avatar Framework — per-executive configuration registry.
//
// Add or update an executive by editing its config entry. Swap renderers by
// setting the relevant asset field — no component changes required:
//   • modelUrl     → activates "3d" mode (GLB/GLTF)
//   • liveAssets   → activates "live" mode (video clips)
//   • portrait JPGs always present → "portrait" mode always available
//
// ─────────────────────────────────────────────────────────────────────────────
// ASSET AUDIT (as of 2026-07-19)
// ─────────────────────────────────────────────────────────────────────────────
// PRESENT:
//   ✓  Portrait JPGs      src/assets/exec-*-portrait-v2.jpg
//   ✓  Portrait JPGs (v1) src/assets/exec-*-portrait.jpg
//   ✓  PNG exec images    src/assets/exec-*.png
//   ✓  HQ background JPGs src/assets/hq-*.jpg
//
// ABSENT (awaiting assets):
//   ✗  GLB/GLTF models    /public/assets/executives/<id>/<id>.glb
//   ✗  Live video clips   /public/assets/executives/<id>/live/*.webm
//
// Auto mode resolves to "portrait" for all executives until assets are supplied.
// ─────────────────────────────────────────────────────────────────────────────
import type { ExecutiveId } from "@/lib/executives";
import type { ExecutiveAvatarConfig, LiveAssets, PresentationConfig } from "./types";

const ASSET_ROOT = "/assets/executives";

function buildConfig(
  id: ExecutiveId,
  overrides: Omit<ExecutiveAvatarConfig, "executive" | "assetRoot" | "modelUrl" | "liveAssets"> & {
    modelUrl?: string | null;
    liveAssets?: LiveAssets | null;
    presentation?: PresentationConfig;
  },
): ExecutiveAvatarConfig {
  const assetRoot = `${ASSET_ROOT}/${id}`;
  return {
    executive: id,
    assetRoot,
    modelUrl: overrides.modelUrl ?? null,
    liveAssets: overrides.liveAssets ?? null,
    presentation: overrides.presentation,
    ...overrides,
  };
}

export const EXECUTIVE_AVATAR_CONFIGS: Record<ExecutiveId, ExecutiveAvatarConfig> = {
  iris: buildConfig("iris", {
    modelUrl:   null, // awaiting asset: /public/assets/executives/iris/iris.glb
    liveAssets: null, // awaiting asset: /public/assets/executives/iris/live/
    previewUrl: null,
    animations: {
      idle: "Idle",
      speaking: "Talk",
      thinking: "Think",
      listening: "Listen",
      reviewing: "Review",
      greeting: "Greet",
      working: "Work",
      celebrating: "Celebrate",
      offline: "Offline",
    },
    presentation: {
      portraitObjectPosition: "center top",
      overlayCalibration: {
        // Eyes approx 28% from top on v2 portrait crop — matches current blink veil default
        eyes:  { top: "28%", left: "8%", width: "84%" },
        mouth: { top: "34%", left: "35%", width: "30%" },
      },
    },
    voice: { voiceId: "iris" },
    camera: "portrait",
    lighting: "studio",
    colorToken: "--iris",
    modelScale: 1,
    canon: {
      role: "Chief Executive Strategist",
      visualIdentity: [
        "intelligent",
        "elegant",
        "calm executive presence",
        "black executive attire",
        "gold MASOPS accents",
        "tablet interface",
        "composed posture",
      ],
      personality: ["confident", "patient", "strategic", "reassuring"],
      environment: "Strategy Office — glass wall to the city skyline",
    },
    spatial: {
      homePosition: [-3.0, 0, 0],
      interactionRadius: 1.4,
      waypoints: { boardroom: [-1.2, 0, -0.4], podium: [0, 0, -1.2] },
    },
  }),

  apex: buildConfig("apex", {
    modelUrl:   null, // awaiting asset: /public/assets/executives/apex/apex.glb
    liveAssets: null, // awaiting asset: /public/assets/executives/apex/live/
    previewUrl: null,
    animations: {
      idle: "Idle",
      speaking: "Talk",
      thinking: "Analyze",
      reviewing: "Review",
      working: "Design",
      greeting: "Greet",
      offline: "Offline",
    },
    presentation: {
      portraitObjectPosition: "center top",
      overlayCalibration: {
        eyes:  { top: "28%", left: "8%", width: "84%" },
        mouth: { top: "34%", left: "35%", width: "30%" },
      },
    },
    voice: { voiceId: "apex" },
    camera: "bust",
    lighting: "command",
    colorToken: "--apex",
    modelScale: 1,
    canon: {
      role: "Chief Systems Architect",
      visualIdentity: [
        "technical",
        "analytical",
        "engineering focused",
        "confident stance",
        "black tactical jacket",
        "MASOPS insignia",
      ],
      personality: ["logical", "efficient", "direct", "technically precise"],
      environment: "Systems Laboratory — architecture diagrams behind glass",
    },
    spatial: {
      homePosition: [-1.0, 0, 0],
      interactionRadius: 1.2,
      waypoints: { boardroom: [-0.4, 0, -0.4] },
    },
  }),

  katana: buildConfig("katana", {
    modelUrl:   null, // awaiting asset: /public/assets/executives/katana/katana.glb
    liveAssets: null, // awaiting asset: /public/assets/executives/katana/live/
    previewUrl: null,
    animations: {
      idle: "Idle",
      speaking: "Talk",
      thinking: "Focus",
      working: "Execute",
      celebrating: "Victory",
      warning: "Alert",
      greeting: "Greet",
      offline: "Offline",
    },
    presentation: {
      portraitObjectPosition: "center top",
      overlayCalibration: {
        eyes:  { top: "28%", left: "8%", width: "84%" },
        mouth: { top: "34%", left: "35%", width: "30%" },
      },
    },
    voice: { voiceId: "katana" },
    camera: "bust",
    lighting: "warroom",
    colorToken: "--katana",
    modelScale: 1,
    canon: {
      role: "Chief Operations Director",
      visualIdentity: [
        "agile",
        "disciplined",
        "execution focused",
        "tactical operations clothing",
        "workflow tablet",
        "alert posture",
      ],
      personality: ["decisive", "organized", "proactive", "execution driven"],
      environment: "Operations Center — live mission timeline",
    },
    spatial: {
      homePosition: [1.0, 0, 0],
      interactionRadius: 1.2,
      waypoints: { boardroom: [0.4, 0, -0.4] },
    },
  }),

  sentinel: buildConfig("sentinel", {
    modelUrl:   null, // awaiting asset: /public/assets/executives/sentinel/sentinel.glb
    liveAssets: null, // awaiting asset: /public/assets/executives/sentinel/live/
    previewUrl: null,
    animations: {
      idle: "Idle",
      speaking: "Talk",
      listening: "Scan",
      warning: "Guard",
      working: "Monitor",
      greeting: "Greet",
      offline: "Offline",
    },
    presentation: {
      portraitObjectPosition: "center top",
      overlayCalibration: {
        // Sentinel has an illuminated visor — disable mouth overlay, keep blink
        eyes:  { top: "28%", left: "8%", width: "84%" },
        mouth: null, // visor obscures mouth; overlay not meaningful
      },
    },
    voice: { voiceId: "sentinel" },
    camera: "portrait",
    lighting: "vault",
    colorToken: "--sentinel",
    modelScale: 1,
    canon: {
      role: "Chief Security & Intelligence Officer",
      visualIdentity: [
        "protective",
        "mysterious",
        "hooded armor",
        "illuminated visor",
        "security focused",
      ],
      personality: ["vigilant", "calm", "defensive", "analytical"],
      environment: "Security Command — global threat intelligence map",
    },
    spatial: {
      homePosition: [3.0, 0, 0],
      interactionRadius: 1.4,
      waypoints: { boardroom: [1.2, 0, -0.4], perimeter: [0, 0, 2.0] },
    },
  }),
};

export function getAvatarConfig(id: ExecutiveId): ExecutiveAvatarConfig {
  return EXECUTIVE_AVATAR_CONFIGS[id];
}

/**
 * Resolve the URL for an auxiliary animation clip that lives beside the
 * executive's base model. Enables the drop-in workflow where new `.glb`
 * files under `assetRoot/` become playable via config edits only.
 */
export function resolveClipUrl(config: ExecutiveAvatarConfig, clipFileName: string): string {
  return `${config.assetRoot}/${clipFileName}`;
}
