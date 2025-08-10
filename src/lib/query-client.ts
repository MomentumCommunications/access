import { QueryClient } from "@tanstack/react-query";
import { ConvexReactClient } from "convex/react";
import { ConvexQueryClient } from "@convex-dev/react-query";

export function createConvexClients() {
  const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL!;
  if (!CONVEX_URL) {
    throw new Error("missing VITE_CONVEX_URL envar");
  }
  
  const convex = new ConvexReactClient(CONVEX_URL, {
    unsavedChangesWarning: false,
  });
  
  const convexQueryClient = new ConvexQueryClient(convex);
  
  return { convex, convexQueryClient };
}

export function createGlobalQueryClient(convexQueryClient: ConvexQueryClient) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        retry: (failureCount) => failureCount < 3,
        // Global cache settings for sidebar persistence
        staleTime: 5 * 60 * 1000, // 5 minutes - balance between freshness and persistence
        gcTime: 30 * 60 * 1000, // 30 minutes - keep data in memory longer
        refetchOnMount: false, // Don't refetch when component mounts if we have cached data
        refetchOnWindowFocus: false, // Don't refetch on window focus
        refetchOnReconnect: "always", // Refetch on network reconnect
      },
    },
  });
  
  // Connect convex query client to react query
  convexQueryClient.connect(queryClient);
  
  return queryClient;
}

// Global singleton instances
let globalClients: { convex: ConvexReactClient; convexQueryClient: ConvexQueryClient; queryClient: QueryClient } | null = null;

export function getGlobalClients() {
  if (!globalClients) {
    const { convex, convexQueryClient } = createConvexClients();
    const queryClient = createGlobalQueryClient(convexQueryClient);
    
    globalClients = {
      convex,
      convexQueryClient,
      queryClient,
    };
  }
  
  return globalClients;
}