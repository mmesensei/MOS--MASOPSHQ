// MOS Provider Facade — the ONLY entry point MOS logic should use.
//
// Usage:
//   import { providers } from "@/lib/providers/index.server";
//   const res = await providers.chat({ capability: "chat.fast" }, { messages: [...] });
//
// The router resolves capability → provider adapter via policy.ts.
// To swap providers or add new ones, edit policy.ts + add an adapter — never
// touch the callers.

import { resolvePolicy } from "./policy";
import {
  lovableChat,
  lovableChatStream,
  lovableEmbed,
  lovableStt,
  lovableTts,
  LOVABLE_PROVIDER_ID,
} from "./lovable-adapter.server";
import type {
  Capability,
  CapabilityRequest,
  ChatOptions,
  ChatResult,
  EmbedOptions,
  EmbedResult,
  SttOptions,
  TtsOptions,
} from "./types";

// Adapter dispatch — one row per (providerId, capability family).
// Adding a new provider = extend these switch statements + register in policy.
async function dispatchChat(providerId: string, model: string, capability: Capability, opts: ChatOptions): Promise<ChatResult> {
  switch (providerId) {
    case LOVABLE_PROVIDER_ID: return lovableChat(model, capability, opts);
    default: throw new Error(`No chat adapter for provider ${providerId}`);
  }
}
function dispatchChatStream(providerId: string, model: string, capability: Capability, opts: ChatOptions) {
  switch (providerId) {
    case LOVABLE_PROVIDER_ID: return lovableChatStream(model, capability, opts);
    default: throw new Error(`No chat-stream adapter for provider ${providerId}`);
  }
}
async function dispatchTts(providerId: string, model: string, opts: TtsOptions): Promise<Response> {
  switch (providerId) {
    case LOVABLE_PROVIDER_ID: return lovableTts(model, opts);
    default: throw new Error(`No tts adapter for provider ${providerId}`);
  }
}
async function dispatchStt(providerId: string, model: string, opts: SttOptions) {
  switch (providerId) {
    case LOVABLE_PROVIDER_ID: return lovableStt(model, opts);
    default: throw new Error(`No stt adapter for provider ${providerId}`);
  }
}
async function dispatchEmbed(providerId: string, model: string, opts: EmbedOptions): Promise<EmbedResult> {
  switch (providerId) {
    case LOVABLE_PROVIDER_ID: return lovableEmbed(model, opts);
    default: throw new Error(`No embedding adapter for provider ${providerId}`);
  }
}

async function observeIfPossible(
  request: CapabilityRequest,
  providerId: string,
  started: number,
  ok: boolean,
  errorKind?: "timeout" | "auth" | "quota" | "5xx" | "malformed" | "unsupported" | "other",
  errorMessage?: string,
) {
  const userId = (request as unknown as { userId?: string }).userId;
  if (!userId) return;
  try {
    const { observeProviderCall } = await import("@/lib/sentinel/runtime.server");
    await observeProviderCall({
      userId,
      provider: providerId,
      capability: request.capability,
      success: ok,
      latencyMs: Date.now() - started,
      errorKind,
      errorMessage,
    });
  } catch { /* swallow */ }
}

export const providers = {
  async chat(request: CapabilityRequest, opts: ChatOptions): Promise<ChatResult> {
    const r = resolvePolicy(request);
    const started = Date.now();
    try {
      const res = await dispatchChat(r.providerId, r.model, request.capability, opts);
      await observeIfPossible(request, r.providerId, started, true);
      return res;
    } catch (err) {
      await observeIfPossible(request, r.providerId, started, false, "other", err instanceof Error ? err.message : undefined);
      throw err;
    }
  },
  chatStream(request: CapabilityRequest, opts: ChatOptions) {
    const r = resolvePolicy(request);
    return dispatchChatStream(r.providerId, r.model, request.capability, opts);
  },
  async tts(request: Omit<CapabilityRequest, "capability"> & { capability?: never }, opts: TtsOptions) {
    const r = resolvePolicy({ ...request, capability: "speech.tts" });
    return dispatchTts(r.providerId, r.model, opts);
  },
  async stt(request: Omit<CapabilityRequest, "capability"> & { capability?: never }, opts: SttOptions) {
    const r = resolvePolicy({ ...request, capability: "speech.stt" });
    return dispatchStt(r.providerId, r.model, opts);
  },
  async embed(request: Omit<CapabilityRequest, "capability"> & { capability?: never }, opts: EmbedOptions) {
    const r = resolvePolicy({ ...request, capability: "embedding.text" });
    return dispatchEmbed(r.providerId, r.model, opts);
  },
  // Inspect current routing without executing — useful for SENTINEL & docs.
  resolve(request: CapabilityRequest) {
    return resolvePolicy(request);
  },
} as const;

export type { Capability, CapabilityRequest } from "./types";
