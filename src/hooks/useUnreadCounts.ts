import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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

  // Collect all channel IDs for batched query
  const allChannelIds = useMemo(() => {
    const publicIds = publicChannels?.map((c) => c?._id).filter(Boolean) || [];
    const privateIds =
      privateChannels?.map((c) => c?._id).filter(Boolean) || [];
    const dmIds = dms?.map((d) => d?._id).filter(Boolean) || [];

    return [...publicIds, ...privateIds, ...dmIds];
  }, [publicChannels, privateChannels, dms]);

  // Use single batched query for all unread counts
  const { data: batchedUnreadCounts, isLoading } = useQuery({
    ...convexQuery(api.messages.getBatchedUnreadCounts, {
      channelIds: allChannelIds,
      userId: userId!,
    }),
    enabled: !!userId && allChannelIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes - rely on real-time updates
    gcTime: Infinity, // Keep in memory indefinitely
    refetchOnMount: false, // Don't refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: true, // Only refetch on reconnect
    refetchInterval: false, // Disable polling completely
  });

  // Create stable empty objects to prevent unnecessary re-renders
  const emptyUnreads = useMemo(() => ({}), []);

  // Build the result objects with memoization to prevent unnecessary re-renders
  const { publicChannelUnreads, privateChannelUnreads, dmUnreads } =
    useMemo(() => {
      if (!batchedUnreadCounts) {
        return {
          publicChannelUnreads: emptyUnreads,
          privateChannelUnreads: emptyUnreads,
          dmUnreads: emptyUnreads,
        };
      }

      const publicUnreads: Record<string, number> = {};
      const privateUnreads: Record<string, number> = {};
      const dmUnreadCounts: Record<string, number> = {};

      // Categorize unread counts by channel type
      Object.entries(batchedUnreadCounts).forEach(([channelIdStr, count]) => {
        // Determine which category this channel belongs to
        const isPublic = publicChannels?.some(
          (c) => String(c?._id) === channelIdStr,
        );
        const isPrivate = privateChannels?.some(
          (c) => String(c?._id) === channelIdStr,
        );
        const isDM = dms?.some((d) => String(d?._id) === channelIdStr);

        if (isPublic) {
          publicUnreads[channelIdStr] = count;
        } else if (isPrivate) {
          privateUnreads[channelIdStr] = count;
        } else if (isDM) {
          dmUnreadCounts[channelIdStr] = count;
        }
      });

      // Fill remaining channels with 0 (for channels not in batched results)
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
      const hasAnyData =
        Object.keys(publicUnreads).length > 0 ||
        Object.keys(privateUnreads).length > 0 ||
        Object.keys(dmUnreadCounts).length > 0;

      return {
        publicChannelUnreads: hasAnyData ? publicUnreads : emptyUnreads,
        privateChannelUnreads: hasAnyData ? privateUnreads : emptyUnreads,
        dmUnreads: hasAnyData ? dmUnreadCounts : emptyUnreads,
      };
    }, [batchedUnreadCounts, publicChannels, privateChannels, dms, emptyUnreads]);

  return {
    publicChannelUnreads,
    privateChannelUnreads,
    dmUnreads,
    isLoading,
  };
}
