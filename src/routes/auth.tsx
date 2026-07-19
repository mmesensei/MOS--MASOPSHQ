import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/hq" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.getElementById("email-input")?.focus();
  }, [mode]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/hq",
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Welcome, Operator. Entering headquarters…");
        navigate({ to: "/hq" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/hq" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/auth/callback",
        },
      });
      if (error) throw error;
      // Browser is redirected to Google — no further action needed here
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-iris via-apex to-sentinel" />
          <span className="font-display text-lg font-semibold">MOS</span>
        </Link>

        <div className="hq-panel p-8">
          <div className="text-center">
            <div className="text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground">
              {mode === "signin" ? "Authenticate" : "Register as Operator"}
            </div>
            <h1 className="mt-2 font-display text-2xl font-semibold">
              {mode === "signin" ? "Enter the headquarters" : "Establish your command"}
            </h1>
          </div>

          <form onSubmit={handleEmail} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Operator name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Joshua"
                  className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
              <input
                id="email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? "…" : mode === "signin" ? "Enter HQ" : "Establish command"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={busy}
            className="w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            Continue with Google
          </button>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "Not registered yet?" : "Already an Operator?"}{" "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              {mode === "signin" ? "Register" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
