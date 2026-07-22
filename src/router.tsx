import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { NotFound } from "./components/not-found";
import { DefaultCatchBoundary } from "./components/default-catch-boundry";
import { getGlobalClients } from "./lib/query-client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useEffect, type ReactNode } from "react";
import {
  markStartupOnce,
  measureStartupOnce,
  STARTUP_PERFORMANCE,
} from "./lib/startup-performance";

function AuthRestorationMarker() {
  const { isLoading } = useConvexAuth();

  useEffect(() => {
    if (isLoading) return;

    markStartupOnce(STARTUP_PERFORMANCE.authRestorationEnd);
    measureStartupOnce(
      STARTUP_PERFORMANCE.authRestorationMeasure,
      STARTUP_PERFORMANCE.authRestorationStart,
      STARTUP_PERFORMANCE.authRestorationEnd,
    );
    markStartupOnce(STARTUP_PERFORMANCE.usersCurrentStart);
  }, [isLoading]);

  return null;
}

function InstrumentedConvexAuthProvider({
  children,
  client,
}: {
  children: ReactNode;
  client: ReturnType<typeof getGlobalClients>["convex"];
}) {
  markStartupOnce(STARTUP_PERFORMANCE.authRestorationStart);

  return (
    <ConvexAuthProvider client={client}>
      <AuthRestorationMarker />
      {children}
    </ConvexAuthProvider>
  );
}

export function getRouter() {
  markStartupOnce(STARTUP_PERFORMANCE.hydrationStart);

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
        <InstrumentedConvexAuthProvider client={convex}>
          {children}
        </InstrumentedConvexAuthProvider>
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
