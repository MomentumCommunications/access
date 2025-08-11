import { createContext, useContext, ReactNode, useMemo } from "react";
import { Id } from "convex/_generated/dataModel";
import { useSidebarData } from "~/hooks/useSidebarData";
import { useSidebarActions } from "~/hooks/useSidebarActions";

interface SidebarDataContextType {
  convexUser?: {
    _id: Id<"users">;
    name: string;
    role?: "admin" | "user";
    displayName?: string;
    email?: string[];
  } | null;
  publicChannels?: Array<{
    _id: Id<"channels">;
    name?: string;
    description: string;
  }> | null;
  privateChannels?: Array<{
    _id: Id<"channels">;
    name?: string;
    description: string;
  }> | null;
  dms?: Array<{
    _id: Id<"channels">;
    otherMembers: string;
  }> | null;
  publicChannelUnreads: Record<string, number>;
  privateChannelUnreads: Record<string, number>;
  dmUnreads: Record<string, number>;
  isLoading: boolean;
  // Add missing individual loading states
  isUserLoading: boolean;
  isPublicChannelsLoading: boolean;
  isPrivateChannelsLoading: boolean;
  isDMsLoading: boolean;
  actions: {
    invalidateUnreadCounts: (channelId?: Id<"channels"> | string) => void;
    invalidateChannelList: () => void;
    refreshSidebarData: () => void;
  };
}

const SidebarDataContext = createContext<SidebarDataContextType | null>(null);

export function SidebarDataProvider({ children }: { children: ReactNode }) {
  const sidebarData = useSidebarData();
  const sidebarActions = useSidebarActions();

  // Memoize the context value to prevent unnecessary re-renders
  // Use a shallow comparison approach - only re-render when core structure changes
  const contextValue = useMemo(() => {
    return {
      ...sidebarData,
      actions: sidebarActions,
    };
  }, [
    // Track only structural changes that require re-rendering
    sidebarData.convexUser?._id,
    sidebarData.publicChannels?.length,
    sidebarData.privateChannels?.length,
    sidebarData.dms?.length,
    sidebarData.isLoading, // Use combined loading state instead of individual ones
    // Track unread counts as JSON strings for stable comparison
    JSON.stringify(sidebarData.publicChannelUnreads),
    JSON.stringify(sidebarData.privateChannelUnreads),
    JSON.stringify(sidebarData.dmUnreads),
    sidebarActions,
  ]);

  return (
    <SidebarDataContext.Provider value={contextValue}>
      {children}
    </SidebarDataContext.Provider>
  );
}

export function useSidebarDataContext() {
  const context = useContext(SidebarDataContext);
  if (!context) {
    throw new Error("useSidebarDataContext must be used within a SidebarDataProvider");
  }
  return context;
}