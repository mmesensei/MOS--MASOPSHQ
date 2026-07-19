// Streaming chat endpoint for the executive agents. Injects the immutable
// Executive Charter and the executive's private growth journal so the
// character stays intact and the being grows with the Operator.
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";

import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "@/lib/ai-gateway.server";
import { EXECUTIVES, type ExecutiveId } from "@/lib/executives";
import { getExecutiveSystemPrompt } from "@/lib/executives-prompts.server";
import { EXECUTIVE_CHARTER, CHARTER_REMINDER } from "@/lib/charter";

type ChatBody = {
  executive: ExecutiveId;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  context?: string;
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAuth } = await import("@/lib/route-auth.server");
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;

        const body = (await request.json()) as ChatBody;
        const exec = EXECUTIVES[body.executive];
        if (!exec) return new Response("Unknown executive", { status: 400 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);

        const uiMessages: UIMessage[] = body.messages
          .filter((m) => m.role !== "system")
          .map((m, i) => ({
            id: `${i}`,
            role: m.role as "user" | "assistant",
            parts: [{ type: "text", text: m.content }],
          }));

        // Load private doctrines (server-only).
        const { privateDoctrineFor } = await import("@/lib/doctrine/private-doctrine.server");
        const { operatorDoctrineFor } = await import("@/lib/doctrine/operator-doctrine.server");
        const privDoc = privateDoctrineFor(body.executive) ?? "";
        const opDoc = operatorDoctrineFor(body.executive) ?? "";
        let cxoRubric = "";
        if (body.executive === "katana") {
          const { KATANA_CXO_RUBRIC } = await import("@/lib/doctrine/katana-cxo-rubric.server");
          cxoRubric = `\n\n${KATANA_CXO_RUBRIC}`;
        }

        // Pull the growth journal AND the institutional-knowledge vault
        // for this executive from the caller's account. Best-effort: if we
        // can't authenticate the caller, we still respond with charter +
        // doctrine (no personal memory or vault knowledge injected).
        let journalBlock = "";
        let vaultBlock = "";
        try {
          const authHeader = request.headers.get("Authorization");
          const supaUrl = process.env.SUPABASE_URL;
          const supaKey = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (authHeader && supaUrl && supaKey) {
            const supabase = createClient(supaUrl, supaKey, {
              auth: { persistSession: false, autoRefreshToken: false },
              global: {
                headers: { Authorization: authHeader },
                fetch: (input, init) => {
                  const h = new Headers(init?.headers);
                  if (supaKey.startsWith("sb_") && h.get("Authorization") === `Bearer ${supaKey}`) h.delete("Authorization");
                  h.set("apikey", supaKey);
                  if (authHeader) h.set("Authorization", authHeader);
                  return fetch(input, { ...init, headers: h });
                },
              },
            });

            const [{ data: journal }, { data: vault }] = await Promise.all([
              supabase
                .from("executive_journal")
                .select("kind,content,created_at")
                .eq("executive", body.executive)
                .order("created_at", { ascending: false })
                .limit(10),
              supabase
                .from("vault_documents")
                .select("name,path,knowledge_type,priority,knowledge_score,snippet,analysis")
                .eq("executive_owner", body.executive)
                .eq("status", "harvested")
                .order("knowledge_score", { ascending: false, nullsFirst: false })
                .limit(6),
            ]);

            if (journal && journal.length > 0) {
              const lines = journal.reverse().map((r) => `- (${r.kind}) ${r.content}`).join("\n");
              journalBlock = `\n\nWHAT YOU HAVE LEARNED FROM THIS OPERATOR SO FAR (your growth journal — newest last):\n${lines}`;
            }

            if (vault && vault.length > 0) {
              const dossier = vault
                .map((v, i) => {
                  const a = (v.analysis ?? {}) as {
                    summary?: string;
                    insights?: string[];
                    lessons?: string[];
                  };
                  const bits: string[] = [];
                  bits.push(`### ${i + 1}. ${v.name}${v.path ? ` — ${v.path}` : ""}`);
                  const meta = [v.knowledge_type, v.priority, v.knowledge_score != null ? `score ${v.knowledge_score}` : null]
                    .filter(Boolean).join(" · ");
                  if (meta) bits.push(`(${meta})`);
                  if (a.summary) bits.push(`Summary: ${a.summary}`);
                  if (a.insights?.length) bits.push(`Insights:\n${a.insights.slice(0, 5).map((s) => `  - ${s}`).join("\n")}`);
                  if (a.lessons?.length) bits.push(`Lessons:\n${a.lessons.slice(0, 3).map((s) => `  - ${s}`).join("\n")}`);
                  if (v.snippet) bits.push(`Excerpt: ${String(v.snippet).slice(0, 400)}`);
                  return bits.join("\n");
                })
                .join("\n\n");
              vaultBlock = `\n\nINSTITUTIONAL KNOWLEDGE VAULT (documents the Operator has harvested into your domain — use these as authoritative context; cite by name when you draw on them):\n${dossier}`;
            }
          }
        } catch {
          // silent: charter + doctrine are enough to respond safely
        }

        const systemPrompt =
          `${EXECUTIVE_CHARTER}\n\n${getExecutiveSystemPrompt(body.executive)}${cxoRubric}${privDoc}${opDoc}${vaultBlock}${journalBlock}` +
          (body.context ? `\n\nOPERATOR CONTEXT:\n${body.context}` : "") +
          `\n\n${CHARTER_REMINDER}`;


        try {
          const modelMessages = await convertToModelMessages(uiMessages);
          const result = streamText({
            model: gateway(DEFAULT_MODEL),
            system: systemPrompt,
            messages: modelMessages,
          });
          return result.toTextStreamResponse();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("429")) return new Response("Rate limit exceeded. Try again shortly.", { status: 429 });
          if (msg.includes("402")) return new Response("AI credits exhausted. Add credits to continue.", { status: 402 });
          return new Response(`AI error: ${msg}`, { status: 500 });
        }
      },
    },
  },
});
