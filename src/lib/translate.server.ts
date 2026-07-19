/**
 * translate.server.ts — AI-powered contextual Korean translation.
 *
 * Uses the same Lovable AI Gateway (Gemini) that all executive features use.
 * Translation is contextual and idiomatic — not word-for-word.
 *
 * Call via the exported server function `translateToKorean`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SYSTEM_PROMPT = `You are a professional Korean localization expert for a high-stakes executive intelligence platform called MASOPS (Mastermind Operations System).

Your task: translate the provided English text into natural, fluent Korean.

Rules:
- Write Korean that sounds like it was originally written in Korean — never like a translation.
- Korean is highly context-sensitive. One English word can have many Korean meanings depending on context. Choose the most natural one for a professional business/strategy setting.
- Keep proper nouns in English: MASOPS, IRIS, APEX, KATANA, SENTINEL, HQ, MOS, SOPs.
- Preserve markdown formatting (**, *, bullet points, newlines) exactly.
- For UI labels and short strings: use crisp, professional Korean (존댓말 where appropriate).
- For longer content like briefings or journal entries: use polished, readable Korean prose.
- Never add explanations or notes — output only the translated text.`;

export const translateToKorean = createServerFn({ method: "POST" })
  .validator(z.object({ text: z.string().max(8000) }))
  .handler(async ({ data }: { data: { text: string } }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      throw new Error("Translation service not configured. Please add LOVABLE_API_KEY.");
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: data.text },
        ],
        temperature: 0.2, // Low temp for consistent, accurate translation
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Translation failed: ${res.status} ${body}`);
    }

    const json = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const translated = json.choices?.[0]?.message?.content?.trim();
    if (!translated) throw new Error("Translation returned empty result");

    return { translated };
  });
