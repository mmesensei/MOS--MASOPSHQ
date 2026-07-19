import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

function AuthedLayout() {
  const router = useRouter();

  // Re-validate auth on visibility change (tab focus) — keeps session fresh
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.getSession().then(({ data }) => {
          if (!data.session) router.navigate({ to: "/auth", replace: true });
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  return <Outlet />;
}

function AuthedError({ error }: { error: Error }) {
  // Redirect to auth on session errors; show recovery UI for everything else
  useEffect(() => {
    const msg = error?.message?.toLowerCase() ?? "";
    if (msg.includes("auth") || msg.includes("session") || msg.includes("user")) {
      supabase.auth.signOut().then(() => {
        window.location.replace("/auth");
      });
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="hq-panel max-w-sm p-8 text-center">
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-destructive">
          Access Error
        </div>
        <h2 className="mt-3 font-display text-lg font-semibold">
          Session could not be verified
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          SENTINEL is clearing your credentials. Redirecting…
        </p>
        <a
          href="/auth"
          className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Return to sign-in
        </a>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
  errorComponent: AuthedError,
});
