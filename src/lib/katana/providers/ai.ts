// AI-text capability adapter for KATANA runner. Wraps Lovable AI Gateway.
import { generateText } from "ai";
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "@/lib/ai-gateway.server";
import { EXECUTIVES, type ExecutiveId } from "@/lib/executives";
import { getExecutiveSystemPrompt } from "@/lib/executives-prompts.server";
import type { Adapter, AdapterResult } from "./capabilities";

export interface AiRunInput {
  agent: ExecutiveId;
  task_kind: string;
  prompt: string;
  context?: string;
  max_output_tokens?: number;
}

// Rough token → cent estimate for cost ledger (Gemini flash is very cheap).
function estimateCostCents(promptChars: number, outputChars: number): number {
  const tokens = Math.ceil((promptChars + outputChars) / 4);
  return Math.max(1, Math.ceil(tokens / 5000)); // ~1c per 5k tokens
}

export const aiTextAdapter: Adapter = {
  capability: "ai_text",
  available: true,
  provider: `lovable-ai:${DEFAULT_MODEL}`,
  async run(input): Promise<AdapterResult> {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { available: false, provider: "lovable-ai", warning: "LOVABLE_API_KEY missing" };
    }
    const i = input as AiRunInput;
    const exec = EXECUTIVES[i.agent];
    if (!exec) {
      return { available: false, provider: "lovable-ai", warning: `Unknown agent ${i.agent}` };
    }

    const gateway = createLovableAiGatewayProvider(key);
    const started = Date.now();
    const { text } = await generateText({
      model: gateway(DEFAULT_MODEL),
      system: getExecutiveSystemPrompt(i.agent),
      prompt: [i.context, `TASK (${i.task_kind}):\n${i.prompt}`].filter(Boolean).join("\n\n"),
    });
    const duration_ms = Date.now() - started;
    const cost_cents = estimateCostCents(i.prompt.length + (i.context?.length ?? 0), text.length);

    return {
      available: true,
      provider: `lovable-ai:${DEFAULT_MODEL}`,
      output: { text, agent: i.agent, task_kind: i.task_kind },
      cost_cents,
      duration_ms,
    };
  },
};
