import { useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "convex/_generated/api";

export function useSidebarData() {
  const user = useUser();

  // Get current user - rely on global QueryClient cache settings
  const { data: convexUser, isLoading: isUserLoading } = useQuery({
    ...convexQuery(api.users.getUserByClerkId, { ClerkId: user.user?.id }),
    enabled: !!user.user?.id,
    // Use default global cache settings from query-client.ts
    staleTime: 10 * 60 * 1000, // 10 minutes - user data changes infrequently
    gcTime: 60 * 60 * 1000, // 1 hour - keep user data cached longer
  });

  // Get channels and DMs - leverage global cache for persistence
  const { data: publicChannels, isLoading: isPublicChannelsLoading } = useQuery(
    {
      ...convexQuery(api.channels.getPublicChannels, {}),
      enabled: !!convexUser,
      // Rely on global cache settings but with specific optimizations
      staleTime: 15 * 60 * 1000, // 15 minutes - balance freshness with cache hits
      gcTime: 2 * 60 * 60 * 1000, // 2 hours - keep channel data cached longer for navigation
    },
  );

  const { data: privateChannels, isLoading: isPrivateChannelsLoading } =
    useQuery({
      ...convexQuery(api.channels.getChannelsByUser, { user: convexUser?._id }),
      enabled: !!convexUser?._id,
      staleTime: 15 * 60 * 1000, // 15 minutes - balance freshness with cache hits
      gcTime: 2 * 60 * 60 * 1000, // 2 hours - keep channel data cached longer for navigation
    });

  const { data: dms, isLoading: isDMsLoading } = useQuery({
    ...convexQuery(api.channels.getDMsByUser, { user: convexUser?._id }),
    enabled: !!convexUser?._id,
    staleTime: 10 * 60 * 1000, // 10 minutes - DMs change more frequently
    gcTime: 2 * 60 * 60 * 1000, // 2 hours - keep DM data cached for navigation
  });

  // Memoize arrays to prevent unnecessary re-renders with stable empty arrays
  const emptyArray = useMemo(() => [], []);
  const memoizedPublicChannels = useMemo(
    () => publicChannels ?? emptyArray,
    [publicChannels],
  );
  const memoizedPrivateChannels = useMemo(
    () => privateChannels ?? emptyArray,
    [privateChannels],
  );
  const memoizedDms = useMemo(() => dms ?? emptyArray, [dms]);

  // Simplified loading states that work with persistent cache
  const hasUserData = !isUserLoading && convexUser;
  const stableLoadingStates = useMemo(() => {
    // Show loading only when we truly don't have cached data
    return {
      isPublicChannelsLoading: hasUserData ? isPublicChannelsLoading : true,
      isPrivateChannelsLoading: hasUserData ? isPrivateChannelsLoading : true,
      isDMsLoading: hasUserData ? isDMsLoading : true,
    };
  }, [
    hasUserData,
    isPublicChannelsLoading,
    isPrivateChannelsLoading,
    isDMsLoading,
  ]);

  return {
    // User data
    convexUser,
    isUserLoading,

    // Channel/DM data (memoized)
    publicChannels: memoizedPublicChannels,
    privateChannels: memoizedPrivateChannels,
    dms: memoizedDms,

    // Stable loading states
    ...stableLoadingStates,

    // Unread counts

    // Combined loading state
    isLoading:
      isUserLoading ||
      stableLoadingStates.isPublicChannelsLoading ||
      stableLoadingStates.isPrivateChannelsLoading ||
      stableLoadingStates.isDMsLoading,
  };
}

