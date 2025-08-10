import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import { getRouterManifest } from "@tanstack/react-start/router-manifest";
import { createRouter } from "./router";
import { createClerkHandler } from "@clerk/tanstack-react-start/server";

// Note: SSR cache hydration is handled by the global QueryClient
// instance created in query-client.ts and provided at the root level.
// The same QueryClient instance persists across client-side navigation.
export default createClerkHandler(
  createStartHandler({
    createRouter,
    getRouterManifest,
  }),
)(defaultStreamHandler);
