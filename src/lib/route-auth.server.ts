// Verifies a Supabase bearer token on raw TanStack server routes.
// Returns { userId } on success, or a 401 Response to short-circuit the handler.
import { createClient } from "@supabase/supabase-js";

export async function requireAuth(request: Request): Promise<{ userId: string } | Response> {
  const authHeader = request.headers.get("Authorization") ?? request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supaUrl || !supaKey) return new Response("Server misconfigured", { status: 500 });

  const supabase = createClient(supaUrl, supaKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: authHeader },
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (supaKey.startsWith("sb_") && h.get("Authorization") === `Bearer ${supaKey}`) h.delete("Authorization");
        h.set("apikey", supaKey);
        h.set("Authorization", authHeader);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return new Response("Unauthorized", { status: 401 });
  return { userId: data.user.id };
}
