import { useEffect, useMemo } from "react";

interface UseDocumentTitleProps {
  publicChannelUnreads: Record<string, number>;
  privateChannelUnreads: Record<string, number>;
  dmUnreads: Record<string, number>;
  isLoading: boolean;
}

export function useDocumentTitle({
  publicChannelUnreads,
  privateChannelUnreads,
  dmUnreads,
  isLoading,
}: UseDocumentTitleProps) {
  // Calculate total unread count
  const totalUnreadCount = useMemo(() => {
    if (isLoading) return 0;
    
    const publicCount = Object.values(publicChannelUnreads).reduce((sum, count) => sum + count, 0);
    const privateCount = Object.values(privateChannelUnreads).reduce((sum, count) => sum + count, 0);
    const dmCount = Object.values(dmUnreads).reduce((sum, count) => sum + count, 0);
    
    return publicCount + privateCount + dmCount;
  }, [publicChannelUnreads, privateChannelUnreads, dmUnreads, isLoading]);

  // Update document title when unread count changes
  useEffect(() => {
    const baseTitle = "Access Momentum";
    
    if (totalUnreadCount > 0) {
      document.title = `${baseTitle} (${totalUnreadCount})`;
    } else {
      document.title = baseTitle;
    }
    
    // Cleanup function to reset title when component unmounts
    return () => {
      document.title = baseTitle;
    };
  }, [totalUnreadCount]);

  return totalUnreadCount;
}