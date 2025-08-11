import { useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";

export function useUnreadCounts(userId?: Id<"users">) {
  // Get user's channels first with caching
  const { data: publicChannels } = useQuery({
    ...convexQuery(api.channels.getPublicChannels, {}),
    enabled: !!userId,
    staleTime: 30 * 60 * 1000, // 30 minutes - rely on real-time updates
    gcTime: Infinity, // Keep in memory indefinitely
    refetchOnMount: false, // Don't refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: true, // Only refetch on reconnect
  });

  const { data: privateChannels } = useQuery({
    ...convexQuery(api.channels.getChannelsByUser, { user: userId }),
    enabled: !!userId,
    staleTime: 30 * 60 * 1000, // 30 minutes - rely on real-time updates
    gcTime: Infinity, // Keep in memory indefinitely
    refetchOnMount: false, // Don't refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: true, // Only refetch on reconnect
  });

  const { data: dms } = useQuery({
    ...convexQuery(api.channels.getDMsByUser, { user: userId }),
    enabled: !!userId,
    staleTime: 15 * 60 * 1000, // 15 minutes - rely on real-time updates
    gcTime: Infinity, // Keep in memory indefinitely
    refetchOnMount: false, // Don't refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: true, // Only refetch on reconnect
  });

  // Collect all channel IDs
  const allChannelIds = useMemo(() => {
    const publicIds = publicChannels?.map((c) => c?._id).filter(Boolean) || [];
    const privateIds =
      privateChannels?.map((c) => c?._id).filter(Boolean) || [];
    const dmIds = dms?.map((d) => d?._id).filter(Boolean) || [];
    
    return [...publicIds, ...privateIds, ...dmIds];
  }, [publicChannels, privateChannels, dms]);

  // Fetch unread counts for ALL channels now (removed the 5-channel limit)
  const testChannelIds = allChannelIds; // Query all channels instead of limiting to 5

  // Use useQueries for dynamic array of queries with better caching
  const unreadQueries = useQueries({
    queries: testChannelIds.map((channelId) => ({
      ...convexQuery(api.messages.getUnreadMessageCount, {
        channelId: channelId!,
        userId: userId!,
      }),
      enabled: !!channelId && !!userId,
      staleTime: 5 * 60 * 1000, // 5 minutes - rely on real-time updates more
      gcTime: Infinity, // Keep in memory indefinitely
      refetchOnMount: false, // Don't refetch when component mounts
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnReconnect: true, // Only refetch on reconnect
      // Convex real-time updates handle most changes, no need for polling
      refetchInterval: false, // Disable polling completely
    })),
  });

  // Create stable empty objects to prevent unnecessary re-renders
  const emptyUnreads = useMemo(() => ({}), []);
  
  // Build the result objects with memoization to prevent unnecessary re-renders
  const { publicChannelUnreads, privateChannelUnreads, dmUnreads } = useMemo(() => {
    const publicUnreads: Record<string, number> = {};
    const privateUnreads: Record<string, number> = {};
    const dmUnreadCounts: Record<string, number> = {};

    // Debug logging for development
    if (process.env.NODE_ENV === 'development') {
      console.log('useUnreadCounts Debug:', {
        testChannelIds,
        unreadQueriesLength: unreadQueries.length,
        queriesWithData: unreadQueries.filter(q => q?.data !== undefined).length,
        publicChannels: publicChannels?.length,
        privateChannels: privateChannels?.length,
        dms: dms?.length,
      });
    }

    // Map unread counts back to their respective categories
    testChannelIds.forEach((channelId, index) => {
      const query = unreadQueries[index];

      if (channelId && query?.data !== undefined) {
        const count = query.data || 0;

        // Convert channelId to string for consistent lookup
        const channelIdStr = String(channelId);

        // Determine which category this channel belongs to
        const isPublic = publicChannels?.some((c) => String(c?._id) === channelIdStr);
        const isPrivate = privateChannels?.some((c) => String(c?._id) === channelIdStr);
        const isDM = dms?.some((d) => String(d?._id) === channelIdStr);

        if (process.env.NODE_ENV === 'development' && count > 0) {
          console.log(`Channel ${channelIdStr} has ${count} unread messages (public: ${isPublic}, private: ${isPrivate}, dm: ${isDM})`);
        }

        if (isPublic) {
          publicUnreads[channelIdStr] = count;
        } else if (isPrivate) {
          privateUnreads[channelIdStr] = count;
        } else if (isDM) {
          dmUnreadCounts[channelIdStr] = count;
        }
      }
    });

    // Fill remaining channels with 0 (for channels not in the test slice)
    publicChannels?.forEach((channel) => {
      const channelIdStr = String(channel?._id);
      if (channel?._id && !(channelIdStr in publicUnreads)) {
        publicUnreads[channelIdStr] = 0;
      }
    });

    privateChannels?.forEach((channel) => {
      const channelIdStr = String(channel?._id);
      if (channel?._id && !(channelIdStr in privateUnreads)) {
        privateUnreads[channelIdStr] = 0;
      }
    });

    dms?.forEach((dm) => {
      const channelIdStr = String(dm?._id);
      if (dm?._id && !(channelIdStr in dmUnreadCounts)) {
        dmUnreadCounts[channelIdStr] = 0;
      }
    });

    // Return stable references to prevent unnecessary re-renders
    const hasAnyData = Object.keys(publicUnreads).length > 0 || 
                      Object.keys(privateUnreads).length > 0 || 
                      Object.keys(dmUnreadCounts).length > 0;
    
    return {
      publicChannelUnreads: hasAnyData ? publicUnreads : emptyUnreads,
      privateChannelUnreads: hasAnyData ? privateUnreads : emptyUnreads,
      dmUnreads: hasAnyData ? dmUnreadCounts : emptyUnreads,
    };
  }, [testChannelIds, unreadQueries, publicChannels, privateChannels, dms]);

  const isLoading = unreadQueries.some((q) => q.isLoading);


  return {
    publicChannelUnreads,
    privateChannelUnreads,
    dmUnreads,
    isLoading,
  };
}

