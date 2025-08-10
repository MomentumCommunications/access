import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";

export function useSidebarActions() {
  const queryClient = useQueryClient();

  const invalidateUnreadCounts = useCallback((channelId?: Id<"channels"> | string) => {
    if (channelId) {
      // Invalidate specific channel's unread count
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return (
            queryKey.includes("messages:getUnreadMessageCount") &&
            queryKey.some((key) => 
              typeof key === "object" && 
              key !== null && 
              "channelId" in key && 
              key.channelId === channelId
            )
          );
        }
      });
    } else {
      // Invalidate all unread counts
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey.includes("messages:getUnreadMessageCount")
      });
    }
  }, [queryClient]);

  const invalidateChannelList = useCallback(() => {
    // Invalidate channel lists to pick up new channels/DMs
    queryClient.invalidateQueries({
      predicate: (query) => {
        const queryKey = query.queryKey;
        return (
          queryKey.includes("channels:getPublicChannels") ||
          queryKey.includes("channels:getChannelsByUser") ||
          queryKey.includes("channels:getDMsByUser")
        );
      }
    });
  }, [queryClient]);

  const refreshSidebarData = useCallback(() => {
    // Refresh all sidebar-related data
    invalidateChannelList();
    invalidateUnreadCounts();
  }, [invalidateChannelList, invalidateUnreadCounts]);

  return useMemo(() => ({
    invalidateUnreadCounts,
    invalidateChannelList,
    refreshSidebarData,
  }), [invalidateUnreadCounts, invalidateChannelList, refreshSidebarData]);
}