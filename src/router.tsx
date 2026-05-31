import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { NotFound } from "./components/not-found";
import { DefaultCatchBoundary } from "./components/default-catch-boundry";
import { getGlobalClients } from "./lib/query-client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

export function getRouter() {
  // Use global singleton clients to ensure cache persistence
  const { convex, queryClient } = getGlobalClients();

  const router = routerWithQueryClient(
    createTanStackRouter({
      routeTree,
      defaultPreload: "intent",
      defaultErrorComponent: DefaultCatchBoundary,
      defaultNotFoundComponent: () => <NotFound />,
      context: { queryClient },
      Wrap: ({ children }) => (
        <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>
      ),
    }),
    queryClient,
  );

  return router;
}

export const createRouter = getRouter;

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
