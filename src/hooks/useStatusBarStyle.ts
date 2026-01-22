import { useEffect } from "react";

export function useStatusBarStyle(isDarkMode: boolean) {
  useEffect(() => {
    let meta = document.querySelector(
      'meta[name="apple-mobile-web-app-status-bar-style"]',
    );
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "apple-mobile-web-app-status-bar-style";
      document.head.appendChild(meta);
    }
    meta.content = isDarkMode ? "black-translucent" : "default";
  }, [isDarkMode]);
}
