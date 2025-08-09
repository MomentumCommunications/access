import { useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";

export function useUnreadCounts(userId?: Id<"users">) {
  // Get user's channels first
  const { data: publicChannels } = useQuery(
    convexQuery(api.channels.getPublicChannels, {}),
  );

  const { data: privateChannels } = useQuery(
    convexQuery(api.channels.getChannelsByUser, { user: userId }),
  );

  const { data: dms } = useQuery(
    convexQuery(api.channels.getDMsByUser, { user: userId }),
  );

  // Collect all channel IDs
  const allChannelIds = useMemo(() => {
    const publicIds = publicChannels?.map((c) => c?._id).filter(Boolean) || [];
    const privateIds =
      privateChannels?.map((c) => c?._id).filter(Boolean) || [];
    const dmIds = dms?.map((d) => d?._id).filter(Boolean) || [];
    
    console.log("Channel breakdown:");
    console.log("- Public channels:", publicIds);
    console.log("- Private channels:", privateIds);
    console.log("- DM channels:", dmIds);
    
    return [...publicIds, ...privateIds, ...dmIds];
  }, [publicChannels, privateChannels, dms]);

  // Fetch unread counts for ALL channels now (removed the 5-channel limit)
  const testChannelIds = allChannelIds; // Query all channels instead of limiting to 5

  // Use useQueries for dynamic array of queries - this is the correct pattern
  const unreadQueries = useQueries({
    queries: testChannelIds.map((channelId) => ({
      ...convexQuery(api.messages.getUnreadMessageCount, {
        channelId: channelId!,
        userId: userId!,
      }),
      enabled: !!channelId && !!userId,
      staleTime: 30000, // Cache for 30 seconds to avoid too frequent refetches
    })),
  });

  // Build the result objects
  const publicChannelUnreads: Record<string, number> = {};
  const privateChannelUnreads: Record<string, number> = {};
  const dmUnreads: Record<string, number> = {};

  // Map unread counts back to their respective categories
  testChannelIds.forEach((channelId, index) => {
    const query = unreadQueries[index];
    console.log(`Processing channel ${channelId}:`, {
      isLoading: query?.isLoading,
      data: query?.data,
      error: query?.error,
      enabled: !!channelId && !!userId,
    });

    if (channelId && query?.data !== undefined) {
      const count = query.data || 0;
      console.log(`✅ Unread count for channel ${channelId}: ${count}`);

      // Determine which category this channel belongs to
      const isPublic = publicChannels?.some((c) => c?._id === channelId);
      const isPrivate = privateChannels?.some((c) => c?._id === channelId);
      const isDM = dms?.some((d) => d?._id === channelId);

      console.log(`Channel ${channelId} categorization:`, { isPublic, isPrivate, isDM });

      if (isPublic) {
        publicChannelUnreads[channelId] = count;
        console.log(`✅ Set public channel ${channelId} unread count to ${count}`);
      } else if (isPrivate) {
        privateChannelUnreads[channelId] = count;
        console.log(`✅ Set private channel ${channelId} unread count to ${count}`);
      } else if (isDM) {
        dmUnreads[channelId] = count;
        console.log(`✅ Set DM ${channelId} unread count to ${count}`);
      } else {
        console.log(`❌ Channel ${channelId} doesn't match any category!`);
      }
    } else if (channelId) {
      console.log(`❌ No data for channel ${channelId} - query:`, query);
    }
  });

  // Fill remaining channels with 0 (for channels not in the test slice)
  publicChannels?.forEach((channel) => {
    if (channel?._id && !(channel._id in publicChannelUnreads)) {
      publicChannelUnreads[channel._id] = 0;
    }
  });

  privateChannels?.forEach((channel) => {
    if (channel?._id && !(channel._id in privateChannelUnreads)) {
      privateChannelUnreads[channel._id] = 0;
    }
  });

  dms?.forEach((dm) => {
    if (dm?._id && !(dm._id in dmUnreads)) {
      dmUnreads[dm._id] = 0;
    }
  });

  const isLoading = unreadQueries.some((q) => q.isLoading);

  return {
    publicChannelUnreads,
    privateChannelUnreads,
    dmUnreads,
    isLoading,
  };
}

