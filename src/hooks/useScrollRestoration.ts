import { useRef, useCallback } from 'react';

interface ScrollState {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  anchorMessageId: string | null;
  anchorOffset: number;
}

export function useScrollRestoration() {
  const scrollStateRef = useRef<ScrollState | null>(null);
  const isRestoringRef = useRef(false);
  const restorationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const captureScrollState = useCallback((viewport: HTMLElement): ScrollState | null => {
    if (!viewport) return null;

    // Find the most stable anchor - the message closest to the center of the viewport
    const viewportRect = viewport.getBoundingClientRect();
    const viewportCenter = viewportRect.top + viewportRect.height / 2;
    
    const messageElements = viewport.querySelectorAll('[data-message-id]');
    let bestAnchor: { element: HTMLElement; distance: number; id: string } | null = null;
    
    for (const element of messageElements) {
      const rect = element.getBoundingClientRect();
      const elementCenter = rect.top + rect.height / 2;
      const distance = Math.abs(elementCenter - viewportCenter);
      
      if (!bestAnchor || distance < bestAnchor.distance) {
        bestAnchor = {
          element: element as HTMLElement,
          distance,
          id: element.getAttribute('data-message-id')!
        };
      }
    }

    if (!bestAnchor) return null;

    return {
      scrollTop: viewport.scrollTop,
      scrollHeight: viewport.scrollHeight,
      clientHeight: viewport.clientHeight,
      anchorMessageId: bestAnchor.id,
      anchorOffset: bestAnchor.element.getBoundingClientRect().top - viewportRect.top
    };
  }, []);

  const restoreScrollPosition = useCallback(
    (viewport: HTMLElement, onComplete?: () => void) => {
      if (!scrollStateRef.current || isRestoringRef.current) {
        onComplete?.();
        return;
      }

      isRestoringRef.current = true;
      const savedState = scrollStateRef.current;
      
      // Clear any existing timeout
      if (restorationTimeoutRef.current) {
        clearTimeout(restorationTimeoutRef.current);
      }

      // Use a single RAF to ensure we're working with the final DOM state
      requestAnimationFrame(() => {
        const anchorElement = viewport.querySelector(
          `[data-message-id="${savedState.anchorMessageId}"]`
        ) as HTMLElement;

        if (anchorElement) {
          // Calculate the target scroll position
          const viewportRect = viewport.getBoundingClientRect();
          const newScrollTop = anchorElement.getBoundingClientRect().top - viewportRect.top - savedState.anchorOffset + viewport.scrollTop;
          
          // Apply scroll position immediately without animation
          viewport.scrollTop = Math.max(0, newScrollTop);
        } else {
          // Fallback: maintain relative position
          const heightDiff = viewport.scrollHeight - savedState.scrollHeight;
          viewport.scrollTop = Math.max(0, savedState.scrollTop + heightDiff);
        }

        // Use a timeout instead of RAF chain for cleanup
        restorationTimeoutRef.current = setTimeout(() => {
          isRestoringRef.current = false;
          onComplete?.();
        }, 16); // Single frame delay
      });
    },
    []
  );

  const startRestoration = useCallback((viewport: HTMLElement) => {
    scrollStateRef.current = captureScrollState(viewport);
    return !!scrollStateRef.current;
  }, [captureScrollState]);

  const isRestoring = useCallback(() => isRestoringRef.current, []);

  return {
    startRestoration,
    restoreScrollPosition,
    isRestoring
  };
}