/**
 * /auth/callback — landing page for all OAuth redirects.
 *
 * Supabase processes the hash/code from Google and stores the session.
 * We wait for that exchange, then navigate to /hq (or /auth on failure).
 * This prevents the race condition where /_authenticated's beforeLoad
 * runs before the session is established from the OAuth redirect.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"waiting" | "error">("waiting");

  useEffect(() => {
    let cancelled = false;

    async function waitForSession() {
      // Give Supabase up to 8 seconds to process the OAuth hash/code
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          navigate({ to: "/hq", replace: true });
          return;
        }
        if (error) break;
        // Poll every 200 ms
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!cancelled) setStatus("error");
    }

    // Also listen for the auth state change event as a faster path
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        cancelled = true;
        navigate({ to: "/hq", replace: true });
      }
    });

    waitForSession();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">
          Sign-in could not be completed.
        </p>
        <a
          href="/auth"
          className="text-sm font-medium text-gold underline underline-offset-4"
        >
          Back to sign-in
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-gold" />
      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        Establishing session…
      </p>
    </div>
  );
}
