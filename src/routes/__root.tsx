import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { LanguageProvider } from "@/lib/i18n";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground">MOS · 404</div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Sector not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This location isn't part of the headquarters. Return to the operations floor.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Return to HQ
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="hq-panel max-w-md p-8 text-center">
        <div className="text-xs font-mono uppercase tracking-[0.3em] text-destructive">System fault</div>
        <h1 className="mt-3 text-xl font-semibold">The headquarters didn't respond</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sentinel logged the fault. You can retry.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
          <a href="/" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MOS — Mastermind Operations System" },
      {
        name: "description",
        content:
          "MOS is a private executive headquarters where IRIS, APEX, KATANA, and SENTINEL — four permanent AI executives — help you strategize, systemize, execute, and protect every mission.",
      },
      { name: "author", content: "MASOPS" },
      { property: "og:title", content: "MOS — Mastermind Operations System" },
      {
        property: "og:description",
        content: "MOS is a private executive headquarters where IRIS, APEX, KATANA, and SENTINEL — four permanent AI executives — help you strategize, systemize, execute, and protect every mission.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MOS — Mastermind Operations System" },
      { name: "twitter:description", content: "MOS is a private executive headquarters where IRIS, APEX, KATANA, and SENTINEL — four permanent AI executives — help you strategize, systemize, execute, and protect every mission." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/a706bf59-d2a4-4773-b353-1052851f58c4" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/a706bf59-d2a4-4773-b353-1052851f58c4" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // suppressHydrationWarning on html/head/body: TanStack Start's TSD debug
  // plugin adds `data-tsd-source` attributes during SSR that are absent on the
  // client. Without this, React 18 discards the entire server-rendered tree and
  // forces a full client re-render — which can trigger the root ErrorComponent.
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster theme="dark" position="top-right" richColors />
      </QueryClientProvider>
    </LanguageProvider>
  );
}
