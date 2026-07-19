// LEGACY shim — kept so existing imports keep working while they migrate
// to `@/lib/providers/index.server`. New code MUST use the capability-based
// provider facade instead of importing this file.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

export const DEFAULT_MODEL = "google/gemini-3-flash-preview";
