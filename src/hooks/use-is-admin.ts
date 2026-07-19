// useIsAdmin — client hook wrapping the isCurrentUserAdmin server fn.
// Do not use this hook for security — it only drives UI. Every privileged
// server fn must call assertAdmin() on its own (defense in depth).
import { useQuery } from "@tanstack/react-query";
import { isCurrentUserAdmin } from "@/lib/admin.functions";

export function useIsAdmin() {
  const q = useQuery({
    queryKey: ["auth.isAdmin"],
    queryFn: () => isCurrentUserAdmin(),
    staleTime: 60_000,
    retry: false,
  });
  return { isAdmin: q.data?.isAdmin === true, isLoading: q.isLoading };
}
