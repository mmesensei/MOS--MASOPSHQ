// Client-only wrapper for the R3F boardroom scene. React Three Fiber and
// three.js touch WebGL / DOM at import time, so the scene must never enter
// the SSR module graph — hence the lazy import behind ClientOnly.
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const BoardroomScene = lazy(() => import("./boardroom-scene"));

function Skeleton() {
  return (
    <div className="flex h-[520px] w-full items-center justify-center rounded-lg border border-border/60 bg-background text-xs font-mono uppercase tracking-widest text-white/40">
      Initializing boardroom…
    </div>
  );
}

export function Boardroom() {
  return (
    <ClientOnly fallback={<Skeleton />}>
      <Suspense fallback={<Skeleton />}>
        <BoardroomScene />
      </Suspense>
    </ClientOnly>
  );
}
