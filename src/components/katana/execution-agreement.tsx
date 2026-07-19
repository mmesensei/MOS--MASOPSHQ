import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X } from "lucide-react";
import { previewExecutionAgreement, acceptOpportunity } from "@/lib/katana.functions";

export function KatanaExecutionAgreement({
  opportunityId,
  onClose,
}: {
  opportunityId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const preview = useServerFn(previewExecutionAgreement);
  const accept = useServerFn(acceptOpportunity);
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["katana", "agreement", opportunityId],
    queryFn: () => preview({ data: { id: opportunityId } }),
  });

  const acceptMut = useMutation({
    mutationFn: (scope: "once" | "always") =>
      accept({
        data: {
          opportunityId,
          ownershipConfirmed: true as const,
          approvalScope: scope,
        },
      }),
    onSuccess: () => {
      toast.success("Mission created");
      qc.invalidateQueries({ queryKey: ["katana", "opportunities"] });
      qc.invalidateQueries({ queryKey: ["missions"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-katana/30 bg-surface shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border/60 bg-surface p-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.25em] text-katana">KATANA Execution Agreement</div>
            <div className="mt-1 text-lg font-semibold">Review before KATANA proceeds</div>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading || !data ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading agreement…</div>
        ) : (
          <div className="space-y-5 p-4">
            <Section label="Mission">
              <div className="font-medium">{data.opportunity.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{data.opportunity.rationale}</p>
            </Section>

            <Section label={`Assets used (${data.assets.length})`}>
              {data.assets.length === 0 ? (
                <div className="text-sm text-muted-foreground">No source assets attached.</div>
              ) : (
                <ul className="space-y-1 text-sm">
                  {data.assets.map((a) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">{a.source}</span>
                      <span>{a.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section label="AI services that will run">
              <ul className="text-sm text-muted-foreground">
                {data.ai_services.map((s) => (
                  <li key={s}>• {s}</li>
                ))}
              </ul>
            </Section>

            <Section label="Deliverables">
              {data.deliverables.length === 0 ? (
                <div className="text-sm text-muted-foreground">Mission planning + draft output.</div>
              ) : (
                <ul className="text-sm">
                  {data.deliverables.map((d, i) => (
                    <li key={i}>• {d}</li>
                  ))}
                </ul>
              )}
            </Section>

            <Section label="Publishing / external actions">
              <div className="text-sm">
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-500">Disabled in V1</span>
                <span className="ml-2 text-muted-foreground">
                  No publishing, uploads, spending, or third-party contact.
                </span>
              </div>
            </Section>

            <Section label="Delegation">
              <div className="text-sm">
                Handoff to <span className="font-mono uppercase">{data.delegate_to}</span> · estimated ~{data.estimated_tokens} tokens
              </div>
            </Section>

            <label className="flex items-start gap-2 rounded-md border border-border/60 bg-background/40 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={ownershipConfirmed}
                onChange={(e) => setOwnershipConfirmed(e.target.checked)}
              />
              <span>
                I confirm I own or have permission to use the source material listed above, and I authorize KATANA to
                proceed with the mission described.
              </span>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                disabled={!ownershipConfirmed || acceptMut.isPending}
                onClick={() => acceptMut.mutate("once")}
                className="rounded-md bg-katana px-4 py-2 text-sm font-medium text-katana-foreground hover:opacity-90 disabled:opacity-40"
              >
                Approve Once
              </button>
              <button
                disabled={!ownershipConfirmed || acceptMut.isPending || data.already_trusted}
                onClick={() => acceptMut.mutate("always")}
                className="rounded-md border border-katana/50 px-4 py-2 text-sm text-katana hover:bg-katana/10 disabled:opacity-40"
                title={data.already_trusted ? "This workflow is already trusted" : ""}
              >
                {data.already_trusted ? "Already trusted" : "Always Approve This Workflow"}
              </button>
              <button
                onClick={onClose}
                className="ml-auto rounded-md border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
