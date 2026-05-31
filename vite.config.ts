// vite.config.ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart(),
    react(),
    tailwindcss(),
    // Temporarily disable PWA plugin due to TanStack Start compatibility issues
    // VitePWA({
    //   registerType: "autoUpdate",
    //   includeAssets: ["favicon.png", "icons/*.png"],
    //   manifest: false,
    //   workbox: {
    //     globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
    //     cleanupOutdatedCaches: true,
    //     clientsClaim: true,
    //     skipWaiting: true,
    //   },
    //   devOptions: {
    //     enabled: false,
    //   },
    // }),
  ],
  build: {
    target: "es2020", // Modern target for better compression
    rollupOptions: {
      output: {
        format: "es", // Ensure ES modules format
        // Disable manual chunks to avoid circular dependency issues during build
        // manualChunks: undefined,
        // Simplify chunk file naming
        chunkFileNames: "assets/[name]-[hash].js",
      },
    },
    // Use safer minification for deployment compatibility
    minify: "esbuild",
    sourcemap: false, // Disable sourcemaps in production for smaller builds
    reportCompressedSize: false, // Skip gzip size reporting for faster builds
    chunkSizeWarningLimit: 500, // Lower chunk size warning
    cssCodeSplit: true, // Split CSS into separate files
    // Enable compression
    assetsInlineLimit: 4096, // Inline small assets
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@tanstack/react-query",
      "@tanstack/react-router",
    ], // Pre-bundle these for better compatibility
    // Force exclude problematic packages that might cause circular deps
    exclude: ["@tanstack/start-server-core"],
  },
  // Add explicit environment variable
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "development",
    ),
  },
});
