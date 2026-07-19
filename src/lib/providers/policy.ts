// Capability → provider routing policy.
//
// This is the ONLY place where "which provider handles what" is decided.
// Swapping providers, adding new adapters, or changing policy per executive
// happens here — never inside MOS business logic.

import type { Capability, CapabilityRequest, PrivacyLevel } from "./types";

export interface PolicyRule {
  capability: Capability;
  providerId: string;
  model: string;
  // Higher priority wins when multiple rules match.
  priority: number;
  // Optional constraint filters — if set, rule only applies when caller matches.
  requiresPrivacyAtMost?: PrivacyLevel;
  maxLatencyMs?: number;
  note?: string;
}

const PRIVACY_ORDER: Record<PrivacyLevel, number> = {
  public: 0,
  internal: 1,
  sensitive: 2,
  commercial: 3,
};

// Default policy table — Lovable AI Gateway covers every capability today.
// Adding a second provider = append rules with higher priority for the
// capabilities it should handle. No MOS code changes needed.
export const DEFAULT_POLICY: PolicyRule[] = [
  // Chat family
  { capability: "chat.fast", providerId: "lovable", model: "google/gemini-3-flash-preview", priority: 10 },
  { capability: "chat.reasoning", providerId: "lovable", model: "google/gemini-2.5-pro", priority: 10 },
  { capability: "chat.coding", providerId: "lovable", model: "openai/gpt-5.4-mini", priority: 10 },
  { capability: "chat.vision", providerId: "lovable", model: "google/gemini-2.5-pro", priority: 10 },
  // Structured output
  { capability: "structured.small", providerId: "lovable", model: "google/gemini-3-flash-preview", priority: 10 },
  { capability: "structured.large", providerId: "lovable", model: "google/gemini-2.5-pro", priority: 10 },
  // Embeddings
  { capability: "embedding.text", providerId: "lovable", model: "openai/text-embedding-3-small", priority: 10 },
  // Image
  { capability: "image.generate", providerId: "lovable", model: "google/gemini-2.5-flash-image", priority: 10 },
  { capability: "image.edit", providerId: "lovable", model: "google/gemini-2.5-flash-image", priority: 10 },
  // Speech
  { capability: "speech.tts", providerId: "lovable", model: "openai/gpt-4o-mini-tts", priority: 10 },
  { capability: "speech.stt", providerId: "lovable", model: "openai/gpt-4o-mini-transcribe", priority: 10 },
];

export interface PolicyResolution {
  providerId: string;
  model: string;
  reason: string;
}

export function resolvePolicy(
  request: CapabilityRequest,
  policy: PolicyRule[] = DEFAULT_POLICY,
): PolicyResolution {
  const callerPrivacy = request.privacy ? PRIVACY_ORDER[request.privacy] : PRIVACY_ORDER.internal;
  const exclude = new Set(request.excludeProviderIds ?? []);

  const applicable = policy
    .filter((rule) => rule.capability === request.capability)
    .filter((rule) => {
      if (rule.requiresPrivacyAtMost) {
        return callerPrivacy <= PRIVACY_ORDER[rule.requiresPrivacyAtMost];
      }
      return true;
    })
    .filter((rule) => {
      if (rule.maxLatencyMs && request.maxLatencyMs) {
        return rule.maxLatencyMs <= request.maxLatencyMs;
      }
      return true;
    })
    .sort((a, b) => b.priority - a.priority);

  const candidates = applicable.filter((rule) => !exclude.has(rule.providerId));

  if (candidates.length === 0) {
    if (exclude.size > 0 && applicable.length > 0) {
      throw new Error(
        `capability_unavailable: no alternate provider for ${request.capability} (excluded: ${[...exclude].join(",")})`,
      );
    }
    throw new Error(`No provider policy rule matches capability ${request.capability}`);
  }
  const winner = candidates[0];
  const reasonSuffix = exclude.size > 0 ? ` (excluded: ${[...exclude].join(",")})` : "";
  return {
    providerId: winner.providerId,
    model: winner.model,
    reason: `policy: capability=${request.capability} privacy=${request.privacy ?? "internal"} → ${winner.providerId}/${winner.model}${reasonSuffix}`,
  };
}
