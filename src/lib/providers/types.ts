// MOS Provider Abstraction — capability contracts.
//
// Core MOS logic requests a CAPABILITY (reasoning, coding, vision, speech,
// embeddings, image generation). The provider layer decides which configured
// adapter satisfies that capability best given policy (privacy, latency, cost,
// availability). No MOS module imports a provider SDK directly.
//
// This file is safe to import from client OR server — it defines types only.

export type Capability =
  | "chat.fast"         // low-latency conversational replies
  | "chat.reasoning"    // deeper multi-step reasoning
  | "chat.coding"       // code generation / edit tasks
  | "chat.vision"       // multimodal image+text understanding
  | "structured.small"  // constrained JSON extraction (short schemas)
  | "structured.large"  // long JSON generation
  | "embedding.text"    // text embeddings
  | "image.generate"    // text → image
  | "image.edit"        // image + prompt → image
  | "speech.tts"        // text → speech audio
  | "speech.stt";       // speech audio → text

export type PrivacyLevel = "public" | "internal" | "sensitive" | "commercial";

export interface CapabilityRequest {
  capability: Capability;
  // Optional caller-declared constraints. Router weighs these against policy.
  privacy?: PrivacyLevel;
  maxLatencyMs?: number;
  budgetHintUsd?: number;
  // For observability + cost ledger.
  callerExecutiveId?: string;
  callerSubsystem?: string;
  // Phase 6 — request-scoped provider exclusion (e.g. recovery alternate-provider retry).
  // Never permanently disables a provider; scoped to this call only.
  excludeProviderIds?: string[];
}

// A resolved provider binding — what the router hands back.
export interface ProviderBinding {
  providerId: string;      // e.g. "lovable"
  adapterVersion: string;
  model: string;           // provider-native model string
  capability: Capability;
  reason: string;          // human-readable policy trace ("privacy=commercial → lovable")
}

// Minimal chat/message shape shared across providers.
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  // Structured-output JSON schema (optional). Adapters translate to native shape.
  jsonSchema?: unknown;
}

export interface ChatResult {
  text: string;
  binding: ProviderBinding;
  usage?: { promptTokens?: number; completionTokens?: number; costUsd?: number };
}

export interface TtsOptions {
  text: string;
  voice: string;
  instructions?: string;
  format?: "pcm" | "mp3";
  stream?: boolean;
}

export interface SttOptions {
  file: File | Blob;
  filename?: string;
  language?: string;
}

export interface EmbedOptions {
  texts: string[];
}

export interface EmbedResult {
  vectors: number[][];
  binding: ProviderBinding;
}

// Every adapter implements the subset of capabilities it supports.
// Unsupported capabilities throw ProviderUnsupportedError so the router
// can fall back or surface a truthful "capability_unavailable" state.
export class ProviderUnsupportedError extends Error {
  constructor(providerId: string, capability: Capability) {
    super(`Provider ${providerId} does not support capability ${capability}`);
    this.name = "ProviderUnsupportedError";
  }
}

export class ProviderCallError extends Error {
  constructor(
    public readonly providerId: string,
    public readonly status: number,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderCallError";
  }
}
