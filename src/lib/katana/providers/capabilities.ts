// KATANA provider capability registry.
// Each capability is a small adapter that either does the work or honestly
// reports { available: false }. Runner never fakes completion for
// unavailable capabilities — it emits a "Production Package Ready" result.

export type Capability =
  | "ai_text"
  | "transcription"
  | "image_analysis"
  | "video_analysis"
  | "scene_detection"
  | "caption_generation"
  | "render"
  | "publish"
  | "translation";

export interface AdapterResult {
  available: boolean;
  provider?: string;
  output?: unknown;
  cost_cents?: number;
  duration_ms?: number;
  warning?: string;
}

export interface Adapter {
  capability: Capability;
  available: boolean;
  provider: string;
  run(input: unknown, ctx: { userId: string }): Promise<AdapterResult>;
}

function unavailable(capability: Capability, provider = "none"): Adapter {
  return {
    capability,
    available: false,
    provider,
    async run() {
      return {
        available: false,
        provider,
        warning: `Capability ${capability} not wired. Task marked Production Package Ready.`,
      };
    },
  };
}

export const STUB_ADAPTERS: Record<Exclude<Capability, "ai_text">, Adapter> = {
  transcription: unavailable("transcription"),
  image_analysis: unavailable("image_analysis"),
  video_analysis: unavailable("video_analysis"),
  scene_detection: unavailable("scene_detection"),
  caption_generation: unavailable("caption_generation"),
  render: unavailable("render"),
  publish: unavailable("publish"),
  translation: unavailable("translation"),
};
