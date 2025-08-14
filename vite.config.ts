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
        manualChunks: {
          // Split large vendor libraries into separate chunks
          clerk: ["@clerk/tanstack-react-start", "@clerk/themes"],
          radix: [
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-context-menu",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-popover",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
          ],
          tanstack: [
            "@tanstack/react-query",
            "@tanstack/react-router",
            "@tanstack/react-router-with-query",
          ],
          convex: ["convex", "@convex-dev/react-query"],
          markdown: ["react-markdown", "remark-gfm"],
          date: ["date-fns", "date-fns-tz"],
          "ui-utils": [
            "clsx",
            "class-variance-authority",
            "tailwind-merge",
            "cmdk",
            "vaul",
            "sonner",
          ],
        },
        // Optimize chunk loading with magic comments
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId
                .split("/")
                .pop()
                ?.replace(/\.[^/.]+$/, "")
            : "chunk";
          return `assets/${facadeModuleId}-[hash].js`;
        },
        // Optimize compression
        compact: true,
      },
    },
    // Enable aggressive minification
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.info", "console.warn"],
        unsafe_comps: true,
        unsafe_math: true,
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
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
