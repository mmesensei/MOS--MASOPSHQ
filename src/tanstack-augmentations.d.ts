// Force TypeScript to load the module augmentation from start-client-core's
// serverRoute.d.ts, which adds the `server` block to
// FilebaseRouteOptionsInterface. Without this explicit path reference, the
// augmentation doesn't reliably propagate to route files that only import
// from @tanstack/react-router.
/// <reference path="../node_modules/@tanstack/start-client-core/dist/esm/serverRoute.d.ts" />
export {};
