import { useEffect, useCallback, useState } from "react";

/**
 * Custom hook to manage app icon badges using the Badging API
 * Automatically sets and clears badges based on unread count
 */
export function useAppBadge(unreadCount: number = 0) {
  const [lastBadgeValue, setLastBadgeValue] = useState<number | null>(null);

  // Check if the Badging API is supported
  const isBadgeSupported = useCallback(() => {
    return typeof navigator !== "undefined" && "setAppBadge" in navigator;
  }, []);

  // Set badge with a number
  const setBadge = useCallback(async (count: number) => {
    if (!isBadgeSupported()) {
      // Fallback: Update document title with unread count
      const originalTitle = document.title.replace(/^\(\d+\) /, "");
      document.title = count > 0 ? `(${count}) ${originalTitle}` : originalTitle;
      setLastBadgeValue(count);
      return false;
    }

    try {
      await navigator.setAppBadge(count);
      setLastBadgeValue(count);
      // Also update title as secondary indicator
      const originalTitle = document.title.replace(/^\(\d+\) /, "");
      document.title = count > 0 ? `(${count}) ${originalTitle}` : originalTitle;
      return true;
    } catch (error) {
      console.error("Failed to set app badge:", error);
      // Fallback to title update
      const originalTitle = document.title.replace(/^\(\d+\) /, "");
      document.title = count > 0 ? `(${count}) ${originalTitle}` : originalTitle;
      setLastBadgeValue(count);
      return false;
    }
  }, [isBadgeSupported]);

  // Clear the badge
  const clearBadge = useCallback(async () => {
    if (!isBadgeSupported()) {
      // Fallback: Clear title prefix
      document.title = document.title.replace(/^\(\d+\) /, "");
      setLastBadgeValue(null);
      return false;
    }

    try {
      await navigator.clearAppBadge();
      setLastBadgeValue(null);
      // Also clear title prefix
      document.title = document.title.replace(/^\(\d+\) /, "");
      return true;
    } catch (error) {
      console.error("Failed to clear app badge:", error);
      // Fallback to clearing title
      document.title = document.title.replace(/^\(\d+\) /, "");
      setLastBadgeValue(null);
      return false;
    }
  }, [isBadgeSupported]);

  // Automatically update badge when unread count changes
  useEffect(() => {
    if (unreadCount > 0) {
      setBadge(unreadCount);
    } else {
      clearBadge();
    }
  }, [unreadCount, setBadge, clearBadge]);

  // Clear badge when the component unmounts or page unloads
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isBadgeSupported()) {
        navigator.clearAppBadge().catch(console.error);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isBadgeSupported]);

  return {
    setBadge,
    clearBadge,
    isSupported: isBadgeSupported(),
    lastBadgeValue,
  };
}