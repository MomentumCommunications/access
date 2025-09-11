import { useState } from "react";
import { Button } from "./ui/button";
import { useAppBadge } from "~/hooks/useAppBadge";

/**
 * Demo component to test the badge functionality
 * This is for development/testing purposes only
 */
export function BadgeDemo() {
  const [count, setCount] = useState(0);
  const { setBadge, clearBadge, isSupported } = useAppBadge();

  return (
    <div className="p-4 space-y-4 border rounded-lg">
      <h3 className="font-semibold">Badge API Demo</h3>
      <p className="text-sm text-muted-foreground">
        Badge API Support: {isSupported ? "✅ Supported" : "❌ Not supported (using title fallback)"}
      </p>
      
      <div className="flex items-center gap-2">
        <span>Current count: {count}</span>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => setCount(c => c + 1)}
        >
          +1
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => setCount(c => Math.max(0, c - 1))}
        >
          -1
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => setCount(0)}
        >
          Clear
        </Button>
      </div>

      <div className="flex gap-2">
        <Button 
          size="sm"
          onClick={() => setBadge(count)}
        >
          Set Badge ({count})
        </Button>
        <Button 
          size="sm"
          variant="secondary"
          onClick={() => clearBadge()}
        >
          Clear Badge
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {isSupported 
          ? "The badge will appear on your app icon (if installed as PWA) or browser tab."
          : "Badge API not supported. Unread count will appear in the browser tab title instead."
        }
      </p>
    </div>
  );
}