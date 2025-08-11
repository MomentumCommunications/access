import { useState, useCallback, useRef } from 'react';

export function useContentMasking() {
  const [isMasked, setIsMasked] = useState(false);
  const maskTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const maskContent = useCallback((container: HTMLElement) => {
    // Pre-emptively freeze the container to prevent layout shifts
    const viewport = container.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    if (viewport) {
      // Disable pointer events and set overflow to hidden to prevent any scrolling
      viewport.style.pointerEvents = 'none';
      viewport.style.overflow = 'hidden';
      
      // Apply fixed dimensions to prevent layout changes
      const rect = viewport.getBoundingClientRect();
      viewport.style.width = `${rect.width}px`;
      viewport.style.height = `${rect.height}px`;
    }
    
    setIsMasked(true);
  }, []);
  
  const unmaskContent = useCallback((container: HTMLElement, delay: number = 0) => {
    if (maskTimeoutRef.current) {
      clearTimeout(maskTimeoutRef.current);
    }
    
    maskTimeoutRef.current = setTimeout(() => {
      const viewport = container.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
      if (viewport) {
        // Restore normal behavior
        viewport.style.pointerEvents = '';
        viewport.style.overflow = '';
        viewport.style.width = '';
        viewport.style.height = '';
      }
      
      setIsMasked(false);
      maskTimeoutRef.current = null;
    }, delay);
  }, []);
  
  return {
    isMasked,
    maskContent,
    unmaskContent
  };
}