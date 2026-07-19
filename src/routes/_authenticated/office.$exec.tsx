import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route: renders the child route (office index or thread) inside <Outlet />.
export const Route = createFileRoute("/_authenticated/office/$exec")({
  component: () => <Outlet />,
});
