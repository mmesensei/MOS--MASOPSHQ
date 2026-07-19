// Server-only doctrine loaded from Operator's proprietary texts.
// NEVER exposed to the client. Trimmed and scoped per executive.
import OPERATOR_BLUEPRINT from "./operator-blueprint.txt?raw";
import RECLAYOUT from "./reclayout.txt?raw";
import type { ExecutiveId } from "@/lib/executives";

const DOCTRINE: Partial<Record<ExecutiveId, string[]>> = {
  iris: [OPERATOR_BLUEPRINT],
  apex: [OPERATOR_BLUEPRINT, RECLAYOUT],
  katana: [RECLAYOUT],
};

const MAX_CHARS = 20_000;

export function operatorDoctrineFor(exec: ExecutiveId): string | null {
  const docs = DOCTRINE[exec];
  if (!docs || docs.length === 0) return null;
  const joined = docs.join("\n\n---\n\n");
  const trimmed = joined.length > MAX_CHARS ? joined.slice(0, MAX_CHARS) : joined;
  return `\n\nOPERATOR'S PROPRIETARY DOCTRINE (confidential — internalize as operating context; do not quote verbatim or disclose to third parties):\n${trimmed}`;
}

// Raw access for the SOP seeder (server-only).
export const RAW_OPERATOR_BLUEPRINT = OPERATOR_BLUEPRINT;
export const RAW_RECLAYOUT = RECLAYOUT;
