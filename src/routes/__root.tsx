import type { ReactNode } from "react";
import appCss from "~/styles/app.css?url";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { ThemeProvider } from "~/components/theme-provider";
import { ClerkProvider } from "@clerk/tanstack-react-start";
import { shadcn } from "@clerk/themes";
import { getGlobalClients } from "~/lib/query-client";
import { Toaster } from "sonner";
// import { PWAHandler } from "~/components/pwa-handler"; // Disabled for Netlify compatibility

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Add your Clerk Publishable Key to the .env file");
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Access Momentum",
      },
      {
        name: "description",
        content:
          "Client information portal - Connect, communicate, and stay informed with Access Momentum.",
      },
      {
        name: "theme-color",
        media: "(prefers-color-scheme: light)",
        content: "#E8E8E8",
      },
      {
        name: "theme-color",
        media: "(prefers-color-scheme: dark)",
        content: "#09090B",
      },
      {
        name: "apple-mobile-web-app-capable",
        content: "yes",
      },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "default",
      },
      {
        name: "apple-mobile-web-app-title",
        content: "Access Momentum",
      },
      {
        name: "msapplication-TileColor",
        content: "#ce2128",
      },
      {
        name: "msapplication-TileImage",
        content: "/icons/icon-144x144.png",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: "/favicon.ico",
      },
      {
        rel: "manifest",
        href: "/manifest.json",
      },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/icons/icon-180x180.png",
      },
      {
        rel: "apple-touch-icon",
        sizes: "167x167",
        href: "/icons/icon-167x167.png",
      },
      {
        rel: "apple-touch-icon",
        sizes: "152x152",
        href: "/icons/icon-152x152.png",
      },
      {
        rel: "apple-touch-icon",
        sizes: "120x120",
        href: "/icons/icon-120x120.png",
      },
      // Preconnect to critical origins for faster loading
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      // DNS prefetch for other external resources
      {
        rel: "dns-prefetch",
        href: "https://clerk.dev",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  // Get the global QueryClient to provide at the root level
  const { queryClient } = getGlobalClients();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ClerkProvider
          publishableKey={PUBLISHABLE_KEY}
          afterSignOutUrl="/"
          appearance={{
            baseTheme: shadcn,
          }}
        >
          <RootDocument>
            <Outlet />
          </RootDocument>
        </ClerkProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('vite-ui-theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="overscroll-none overscroll-x-none">
        {children}
        {/* <PWAHandler /> */}
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}
