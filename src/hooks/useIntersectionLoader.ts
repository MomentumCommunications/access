import { useEffect, useRef, useCallback } from 'react';

interface UseIntersectionLoaderProps {
  onLoadOlder: () => Promise<void>;
  onLoadNewer: () => Promise<void>;
  hasMoreOlder: boolean;
  hasMoreNewer: boolean;
  loadingOlder: boolean;
  loadingNewer: boolean;
  enabled: boolean;
}

export function useIntersectionLoader({
  onLoadOlder,
  onLoadNewer,
  hasMoreOlder,
  hasMoreNewer,
  loadingOlder,
  loadingNewer,
  enabled
}: UseIntersectionLoaderProps) {
  const topTriggerRef = useRef<HTMLDivElement>(null);
  const bottomTriggerRef = useRef<HTMLDivElement>(null);
  
  const handleLoadOlder = useCallback(async () => {
    if (loadingOlder || !hasMoreOlder || !enabled) return;
    await onLoadOlder();
  }, [loadingOlder, hasMoreOlder, onLoadOlder, enabled]);
  
  const handleLoadNewer = useCallback(async () => {
    if (loadingNewer || !hasMoreNewer || !enabled) return;
    await onLoadNewer();
  }, [loadingNewer, hasMoreNewer, onLoadNewer, enabled]);
  
  useEffect(() => {
    const topTrigger = topTriggerRef.current;
    const bottomTrigger = bottomTriggerRef.current;
    
    if (!topTrigger || !bottomTrigger || !enabled) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          
          if (entry.target === topTrigger) {
            handleLoadOlder();
          } else if (entry.target === bottomTrigger) {
            handleLoadNewer();
          }
        });
      },
      {
        rootMargin: '100px', // Start loading when 100px away from trigger
        threshold: 0
      }
    );
    
    observer.observe(topTrigger);
    observer.observe(bottomTrigger);
    
    return () => {
      observer.unobserve(topTrigger);
      observer.unobserve(bottomTrigger);
      observer.disconnect();
    };
  }, [handleLoadOlder, handleLoadNewer, enabled]);
  
  return {
    topTriggerRef,
    bottomTriggerRef
  };
}