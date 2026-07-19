// The four permanent executive agents of MOS — client-safe identity registry.
//
// Stable executive IDs are the immutable internal identity. Display names,
// titles, and visual attributes may evolve without disconnecting memory,
// state, analytics, or workflows.
//
// SERVER-ONLY doctrine (system prompts) lives in
// `src/lib/executives-prompts.server.ts` and MUST NOT be imported by client
// code.

export type ExecutiveId = "iris" | "apex" | "katana" | "sentinel";

export const EXECUTIVE_IDS: readonly ExecutiveId[] = ["iris", "apex", "katana", "sentinel"] as const;

export interface Executive {
  /** Immutable internal identity. Never change. */
  id: ExecutiveId;
  /** Display name — may evolve. */
  name: string;
  /** Role title — may evolve. */
  title: string;
  /** Short tagline. */
  signature: string;
  /** Signature question the executive asks. */
  question: string;
  /** Tailwind text token. */
  colorClass: string;
  /** Tailwind accent (bg + fg) tokens. */
  accentClass: string;
  /** Signature glow utility. */
  glowClass: string;
  /** Signature background tint. */
  bgTint: string;
  /** Environment label (e.g. Strategy Office). */
  environment: string;
  /** Public responsibilities — safe to render on the client. */
  responsibilities: readonly string[];
}

export const EXECUTIVES: Record<ExecutiveId, Executive> = {
  iris: {
    id: "iris",
    name: "IRIS",
    title: "Chief Executive Strategist",
    signature: "Vision • Wisdom • Leadership",
    question: "What should we do — and why does it matter?",
    colorClass: "text-iris",
    accentClass: "bg-iris text-iris-foreground",
    glowClass: "exec-glow-iris",
    bgTint: "bg-iris/10",
    environment: "Strategy Office",
    responsibilities: [
      "Strategic planning & mission alignment",
      "Leadership coaching",
      "Decision intelligence",
      "Opportunity analysis",
      "Long-term legacy development",
      "Coordinating the Executive Council",
    ],
  },
  apex: {
    id: "apex",
    name: "APEX",
    title: "Chief Systems Architect",
    signature: "Structure • Optimization • Intelligence",
    question: "How should this work?",
    colorClass: "text-apex",
    accentClass: "bg-apex text-apex-foreground",
    glowClass: "exec-glow-apex",
    bgTint: "bg-apex/10",
    environment: "Systems Laboratory",
    responsibilities: [
      "Process engineering & workflow architecture",
      "SOP development & documentation",
      "KPI design & measurement",
      "Knowledge organization",
      "Optimization & scalability",
      "Reusable framework design",
    ],
  },
  katana: {
    id: "katana",
    name: "KATANA",
    title: "Chief Universal Execution Officer",
    signature: "Execution • Automation • Scale",
    question: "How do we get it done?",
    colorClass: "text-katana",
    accentClass: "bg-katana text-katana-foreground",
    glowClass: "exec-glow-katana",
    bgTint: "bg-katana/10",
    environment: "Operations Center",
    responsibilities: [
      "Mission decomposition & task orchestration",
      "Workflow & automation design",
      "Resource coordination",
      "Progress tracking & blockers",
      "Post-mission review & lessons captured",
      "AI workforce command",
    ],
  },
  sentinel: {
    id: "sentinel",
    name: "SENTINEL",
    title: "Chief Security & Intelligence Officer",
    signature: "Protect • Monitor • Analyze",
    question: "What could go wrong?",
    colorClass: "text-sentinel",
    accentClass: "bg-sentinel text-sentinel-foreground",
    glowClass: "exec-glow-sentinel",
    bgTint: "bg-sentinel/10",
    environment: "Security Command",
    responsibilities: [
      "Risk & vulnerability assessment",
      "Governance & compliance",
      "Data & reputation protection",
      "Audit trails & permissions",
      "Threat monitoring",
      "Constitutional oversight",
    ],
  },
};

export const EXECUTIVE_LIST = Object.values(EXECUTIVES);

export function isExecutiveId(value: unknown): value is ExecutiveId {
  return typeof value === "string" && (EXECUTIVE_IDS as readonly string[]).includes(value);
}
