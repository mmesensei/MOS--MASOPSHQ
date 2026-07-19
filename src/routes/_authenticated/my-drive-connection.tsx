import { createFileRoute, Link } from "@tanstack/react-router";
import { MosShell } from "@/components/mos-shell";
import { ArrowRight, Cloud } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-drive-connection")({
  component: DeprecatedPage,
});

function DeprecatedPage() {
  return (
    <MosShell>
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Cloud className="mx-auto h-10 w-10 text-iris" />
        <h1 className="mt-4 font-display text-2xl">Google Drive has a new home</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Google Drive is now managed alongside every other knowledge source on the
          Knowledge Connections page.
        </p>
        <Link
          to="/knowledge-connections"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-iris px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Go to Knowledge Connections <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </MosShell>
  );
}
