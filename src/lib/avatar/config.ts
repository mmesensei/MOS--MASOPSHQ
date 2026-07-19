// Executive Avatar Framework — per-executive configuration registry.
//
// Add or update an executive by editing its config entry. Swap 2D → 3D by
// setting `modelUrl` to the GLB path — no component changes required.
//
// Asset drop-in workflow (FD-003B):
//   /public/assets/executives/<id>/<id>.glb          ← base model
//   /public/assets/executives/<id>/idle.glb          ← auxiliary clip
//   /public/assets/executives/<id>/speak.glb         ← auxiliary clip
//   ...
// The framework resolves URLs via `resolveClipUrl(config, name)`, so a new
// clip only needs a matching entry in `animations` to become playable.
import type { ExecutiveId } from "@/lib/executives";
import type { ExecutiveAvatarConfig } from "./types";

const ASSET_ROOT = "/assets/executives";

function buildConfig(
  id: ExecutiveId,
  overrides: Omit<ExecutiveAvatarConfig, "executive" | "assetRoot" | "modelUrl"> & {
    modelUrl?: string | null;
  },
): ExecutiveAvatarConfig {
  const assetRoot = `${ASSET_ROOT}/${id}`;
  return {
    executive: id,
    assetRoot,
    modelUrl: overrides.modelUrl ?? null,
    ...overrides,
  };
}

export const EXECUTIVE_AVATAR_CONFIGS: Record<ExecutiveId, ExecutiveAvatarConfig> = {
  iris: buildConfig("iris", {
    modelUrl: null, // Drop: /public/assets/executives/iris/iris.glb
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
    modelUrl: null,
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
    modelUrl: null,
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
    modelUrl: null,
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
