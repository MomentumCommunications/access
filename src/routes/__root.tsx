import { useEffect, type ReactNode } from "react";
import appCss from "~/styles/app.css?url";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { ThemeProvider } from "~/components/theme-provider";
import { getGlobalClients } from "~/lib/query-client";
import { Toaster } from "sonner";
// import { PWAHandler } from "~/components/pwa-handler"; // Disabled for Netlify compatibility

const IOS_STARTUP_SCREENS = [
  { width: 320, height: 568, scale: 2 },
  { width: 375, height: 667, scale: 2 },
  { width: 414, height: 736, scale: 3 },
  { width: 375, height: 812, scale: 3 },
  { width: 414, height: 896, scale: 2 },
  { width: 414, height: 896, scale: 3 },
  { width: 390, height: 844, scale: 3 },
  { width: 428, height: 926, scale: 3 },
  { width: 393, height: 852, scale: 3 },
  { width: 430, height: 932, scale: 3 },
  { width: 402, height: 874, scale: 3 },
  { width: 440, height: 956, scale: 3 },
  { width: 744, height: 1133, scale: 2 },
  { width: 768, height: 1024, scale: 2 },
  { width: 820, height: 1180, scale: 2 },
  { width: 834, height: 1112, scale: 2 },
  { width: 834, height: 1194, scale: 2 },
  { width: 834, height: 1210, scale: 2 },
  { width: 1024, height: 1366, scale: 2 },
  { width: 1032, height: 1376, scale: 2 },
].flatMap(({ width, height, scale }) => {
  const media = [
    `(device-width: ${width}px)`,
    `(device-height: ${height}px)`,
    `(-webkit-device-pixel-ratio: ${scale})`,
    "(orientation: portrait)",
  ].join(" and ");

  return [
    {
      rel: "apple-touch-startup-image",
      href: `/splash/ios/launch-${width * scale}x${height * scale}-light.png`,
      media,
    },
    {
      rel: "apple-touch-startup-image",
      href: `/splash/ios/launch-${width * scale}x${height * scale}-dark.png`,
      media: `${media} and (prefers-color-scheme: dark)`,
    },
  ];
});

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
      {
        rel: "preload",
        href: "/icons/icon-120x120.png",
        as: "image",
      },
      ...IOS_STARTUP_SCREENS,
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
        <RootDocument>
          <BootSplashDismiss />
          <Outlet />
        </RootDocument>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function BootSplashDismiss() {
  useEffect(() => {
    document.documentElement.dataset.appReady = "true";
  }, []);

  return null;
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html suppressHydrationWarning>
      <head>
        <HeadContent />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              #app-boot-splash {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                display: grid;
                place-items: center;
                background: #e8e8e8;
                color: #18181b;
                transition: opacity 180ms ease, visibility 180ms ease;
              }

              .dark #app-boot-splash {
                background: #09090b;
                color: #fafafa;
              }

              html[data-app-ready="true"] #app-boot-splash {
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
              }

              .app-boot-splash__content {
                display: grid;
                justify-items: center;
                gap: 14px;
              }

              .app-boot-splash__logo {
                width: 64px;
                height: 64px;
                border-radius: 16px;
                box-shadow: 0 18px 45px rgb(0 0 0 / 18%);
              }

              .app-boot-splash__brand {
                font: 700 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                letter-spacing: 0.08em;
              }

              .app-boot-splash__bar {
                width: 96px;
                height: 3px;
                overflow: hidden;
                border-radius: 999px;
                background: rgb(0 0 0 / 12%);
              }

              .dark .app-boot-splash__bar {
                background: rgb(255 255 255 / 14%);
              }

              .app-boot-splash__bar::after {
                content: "";
                display: block;
                width: 42px;
                height: 100%;
                border-radius: inherit;
                background: #ce2128;
                animation: app-boot-splash-slide 900ms ease-in-out infinite;
              }

              @keyframes app-boot-splash-slide {
                0% {
                  transform: translateX(-44px);
                }
                50% {
                  transform: translateX(98px);
                }
                100% {
                  transform: translateX(98px);
                }
              }

              @media (prefers-reduced-motion: reduce) {
                #app-boot-splash {
                  transition: none;
                }

                .app-boot-splash__bar::after {
                  animation: none;
                  width: 100%;
                }
              }
            `,
          }}
        />
      </head>
      <body className="overscroll-none overscroll-x-none">
        <div id="app-boot-splash" aria-hidden="true">
          <div className="app-boot-splash__content">
            <img
              className="app-boot-splash__logo"
              src="/icons/icon-120x120.png"
              alt=""
            />
            <div className="app-boot-splash__brand">ACCESS MOMENTUM</div>
            <div className="app-boot-splash__bar" />
          </div>
        </div>
        {children}
        {/* <PWAHandler /> */}
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}
