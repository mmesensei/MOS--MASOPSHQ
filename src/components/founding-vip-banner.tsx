import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { getMyVipStatus } from "@/lib/founding-vip.functions";
import { Sparkles } from "lucide-react";

export function FoundingVipBanner() {
  const q = useQuery({ queryKey: ["myVip"], queryFn: () => getMyVipStatus(), staleTime: 60_000 });
  const vip = q.data;

  useEffect(() => {
    if (!vip?.is_founding_vip || !vip.founding_vip_number) return;
    const key = `founding_vip_welcome_${vip.founding_vip_number}`;
    if (typeof window === "undefined" || localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    toast.success(
      `Welcome to the Founding 100. You are one of the first 100 MOS executives and hold a permanent Founding Lifetime VIP entitlement to the full MOS experience. — Founding Lifetime VIP #${String(vip.founding_vip_number).padStart(3, "0")}`,
      { duration: 8000 },
    );
  }, [vip?.is_founding_vip, vip?.founding_vip_number]);

  if (!vip?.is_founding_vip || vip.vip_status !== "active" || !vip.founding_vip_number) return null;

  return (
    <div className="mb-6 hq-panel flex items-center gap-3 border-primary/40 bg-gradient-to-r from-primary/10 via-transparent to-transparent p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary">Founding Lifetime VIP</div>
        <div className="font-display text-lg font-semibold">
          #{String(vip.founding_vip_number).padStart(3, "0")} · Lifetime Founder
        </div>
        <div className="text-xs text-muted-foreground">
          Permanent lifetime access to the full MOS experience. No expiration, no renewal.
        </div>
      </div>
    </div>
  );
}
