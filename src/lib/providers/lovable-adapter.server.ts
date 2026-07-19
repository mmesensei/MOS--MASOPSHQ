// Lovable AI Gateway adapter.
//
// This is the ONLY module allowed to talk to Lovable AI Gateway directly.
// All other MOS code goes through the provider facade (../index.server.ts).

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, streamText } from "ai";
import type {
  ChatOptions,
  ChatResult,
  EmbedOptions,
  EmbedResult,
  ProviderBinding,
  SttOptions,
  TtsOptions,
} from "./types";
import { ProviderCallError } from "./types";

export const LOVABLE_PROVIDER_ID = "lovable";
export const LOVABLE_ADAPTER_VERSION = "1.0.0";
const BASE_URL = "https://ai.gateway.lovable.dev/v1";

function requireKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new ProviderCallError(LOVABLE_PROVIDER_ID, 500, "LOVABLE_API_KEY not configured", false);
  return key;
}

function buildProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: BASE_URL,
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

function bindingFor(model: string, capability: ProviderBinding["capability"]): ProviderBinding {
  return {
    providerId: LOVABLE_PROVIDER_ID,
    adapterVersion: LOVABLE_ADAPTER_VERSION,
    model,
    capability,
    reason: `lovable adapter model=${model}`,
  };
}

export async function lovableChat(
  model: string,
  capability: ProviderBinding["capability"],
  opts: ChatOptions,
): Promise<ChatResult> {
  const provider = buildProvider(requireKey());
  try {
    const result = await generateText({
      model: provider(model),
      messages: opts.messages,
      temperature: opts.temperature,
    });
    return {
      text: result.text,
      binding: bindingFor(model, capability),
      usage: {
        promptTokens: result.usage?.inputTokens,
        completionTokens: result.usage?.outputTokens,
      },
    };
  } catch (err) {
    const anyErr = err as { statusCode?: number; message?: string };
    const status = anyErr.statusCode ?? 500;
    throw new ProviderCallError(
      LOVABLE_PROVIDER_ID,
      status,
      anyErr.message ?? "chat failed",
      status === 429 || status >= 500,
    );
  }
}

export function lovableChatStream(
  model: string,
  capability: ProviderBinding["capability"],
  opts: ChatOptions,
) {
  const provider = buildProvider(requireKey());
  const result = streamText({
    model: provider(model),
    messages: opts.messages,
    temperature: opts.temperature,
  });
  return { result, binding: bindingFor(model, capability) };
}

export async function lovableTts(model: string, opts: TtsOptions): Promise<Response> {
  const key = requireKey();
  const res = await fetch(`${BASE_URL}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: opts.text,
      voice: opts.voice,
      instructions: opts.instructions,
      stream_format: opts.stream ? "sse" : undefined,
      response_format: opts.format ?? "pcm",
    }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new ProviderCallError(LOVABLE_PROVIDER_ID, res.status, `TTS failed: ${msg}`, res.status === 429 || res.status >= 500);
  }
  return res;
}

export async function lovableStt(model: string, opts: SttOptions): Promise<{ text: string }> {
  const key = requireKey();
  const form = new FormData();
  form.append("model", model);
  form.append("file", opts.file, opts.filename ?? "recording.wav");
  if (opts.language) form.append("language", opts.language);
  const res = await fetch(`${BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new ProviderCallError(LOVABLE_PROVIDER_ID, res.status, `STT failed: ${msg}`, res.status === 429 || res.status >= 500);
  }
  const json = await res.json().catch(() => ({}));
  return { text: (json as { text?: string }).text ?? "" };
}

export async function lovableEmbed(model: string, opts: EmbedOptions): Promise<EmbedResult> {
  const key = requireKey();
  const res = await fetch(`${BASE_URL}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: opts.texts }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new ProviderCallError(LOVABLE_PROVIDER_ID, res.status, `Embedding failed: ${msg}`, res.status === 429 || res.status >= 500);
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return {
    vectors: json.data.map((d) => d.embedding),
    binding: bindingFor(model, "embedding.text"),
  };
}
