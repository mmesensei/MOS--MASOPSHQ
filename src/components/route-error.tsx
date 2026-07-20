// Shared route-level error fallback. Add as `errorComponent` on any
// createFileRoute that might throw (AI calls, WebGL, data loaders).
import { useRouter } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { MosShell } from "@/components/mos-shell";

interface Props {
  error: Error;
  reset: () => void;
}

export function RouteError({ error, reset }: Props) {
  const router = useRouter();

  return (
    <MosShell>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
        <AlertTriangle className="h-10 w-10 text-yellow-500" />
        <div>
          <div className="font-display text-xl font-semibold">System interrupt</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {error?.message || "An unexpected error occurred"}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
          <button
            onClick={() => router.navigate({ to: "/hq" })}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-4 py-2 text-sm hover:bg-muted/40 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to HQ
          </button>
        </div>
      </div>
    </MosShell>
  );
}
