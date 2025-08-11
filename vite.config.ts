// vite.config.ts
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    port: 3000,
    // Add middleware to handle Firefox dynamic import MIME type issues
    middlewares: [
      (req, res, next) => {
        // Handle dynamic imports with query parameters for Firefox
        if (req.url?.includes('.tsx?') || req.url?.includes('.ts?')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
        next();
      },
    ],
  },
  plugins: [
    tsConfigPaths(), 
    tanstackStart(), 
    tailwindcss()
  ],
  build: {
    target: 'es2015', // Ensure compatibility with older browsers
    rollupOptions: {
      output: {
        format: 'es', // Ensure ES modules format
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'], // Pre-bundle these for better compatibility
  },
  // Add explicit environment variable
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
});
