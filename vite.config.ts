// vite.config.ts
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    port: 3000,
    // Add middleware to handle Firefox dynamic import MIME type issues
    middlewares: [
      (req, res, next) => {
        // Handle dynamic imports with query parameters for Firefox
        if (req.url?.includes(".tsx?") || req.url?.includes(".ts?")) {
          res.setHeader(
            "Content-Type",
            "application/javascript; charset=utf-8",
          );
        }
        next();
      },
    ],
  },
  plugins: [
    tsConfigPaths(),
    tanstackStart({
      target: "netlify",
      ssr: true,
    }),
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
        // Optimize compression
        compact: true,
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
  // Improve tree shaking
  esbuild: {
    treeShaking: true,
    // Remove console logs in production
    drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
  },
  // Add explicit environment variable
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "development",
    ),
  },
});
