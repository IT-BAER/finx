import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname, "../"), "");

  return {
    base: "/",
    define: {
      "import.meta.env.VITE_DISABLE_REGISTRATION": JSON.stringify(
        env.DISABLE_REGISTRATION || "true",
      ),
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: [
          "favicon.ico",
          "apple-touch-icon.png",
          "masked-icon.svg",
        ],
        // Explicit manifest so installed app name is "FinX"
        manifest: {
          name: "FinX - Personal Finance Tracker",
          short_name: "FinX",
          description:
            "Modern personal finance tracking application with comprehensive analytics and budgeting tools",
          start_url: "/",
          scope: "/",
          display: "standalone",
          orientation: "portrait-primary",
          theme_color: "#2563eb",
          background_color: "#ffffff",
          lang: "en",
          dir: "ltr",
          categories: ["finance", "productivity", "business"],
          icons: [
            { src: "/icons/favicon.ico", sizes: "16x16", type: "image/x-icon" },
            { src: "/logos/logo-32.png", sizes: "32x32", type: "image/png", purpose: "any" },
            { src: "/logos/logo-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/logos/logo-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/logos/logo-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/logos/logo-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
          shortcuts: [
            {
              name: "Add Transaction",
              short_name: "Add",
              description: "Quickly add a new transaction",
              url: "/add-transaction",
              icons: [{ src: "/icons/add.svg", sizes: "96x96" }],
            },
            {
              name: "View Reports",
              short_name: "Reports",
              description: "View financial reports and analytics",
              url: "/reports",
              icons: [{ src: "/icons/chart.svg", sizes: "96x96" }],
            },
          ],
          share_target: {
            action: "/add-transaction",
            method: "GET",
            enctype: "application/x-www-form-urlencoded",
            params: { title: "title", text: "text", url: "url" },
          },
        },
        workbox: {
          globPatterns: [
            "**/*.{js,css,html,ico,png,svg,woff2,webmanifest}",
            "*.webmanifest",
          ],
          globIgnores: [
            // Silence Workbox warning when no SVG icons are emitted to build/icons
            "icons/**/*.svg",
          ],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/_/, /\/api\//],
          runtimeCaching: [
            // Health endpoint - always network only to reflect true server status
            {
              urlPattern: /\/api\/health$/,
              handler: "NetworkOnly",
              options: {
                cacheName: "health-no-cache",
              },
            },
            // App shell - always cache first, update in background
            {
              urlPattern: /^https?:\/\/[^\/]+\/?$/,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "app-shell",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
              },
            },
      // API data - prefer fresh values; use NetworkFirst with short TTL to allow offline fallback
            {
              urlPattern:
        /^https?:\/\/[^\/]+\/api\/(transactions|categories|sources|targets|users)/,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-data-cache",
                networkTimeoutSeconds: 8,
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60, // 1 hour
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
                plugins: [
                  {
                    cacheKeyWillBeUsed: async ({ request }) => {
                      // Normalize API URLs for caching fallback only (do not cache UI value endpoints aggressively)
                      const url = new URL(request.url);
                      return `${url.origin}${url.pathname}${url.search}`;
                    },
                  },
                ],
              },
            },
            // Do NOT cache auth endpoints
            // Icons - critical for offline functionality
            {
              urlPattern: /\/icons\/.*\.svg$/,
              handler: "CacheFirst",
              options: {
                cacheName: "icons-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
              },
            },
            // Static assets
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
              handler: "CacheFirst",
              options: {
                cacheName: "images-cache",
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
            {
              urlPattern: /\.(?:js|css)$/,
              // Prefer StaleWhileRevalidate so new versions are picked up quickly
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "static-resources",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
            {
              urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
              handler: "CacheFirst",
              options: {
                cacheName: "fonts-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
              },
            },
          ],
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    server: {
      host: true,
      port: 3000,
      open: true,
      allowedHosts: ["localhost", "finx.it-baer.net"],
      proxy: {
        "/api": {
          target: "http://localhost:5000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: "build",
      cssCodeSplit: true,
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            charts: [
              "chart.js",
              "react-chartjs-2",
              "chartjs-plugin-datalabels",
            ],
            motion: ["framer-motion"],
            vendor: ["axios"],
          },
          chunkFileNames: (chunkInfo) => {
            // Keep initial route chunks lighter
            if (chunkInfo.name.includes("Dashboard") || chunkInfo.name.includes("index")) {
              return "assets/[name]-[hash].js";
            }
            return "assets/[name]-[hash].js";
          },
        },
      },
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "framer-motion",
        "axios",
      ],
    },
    css: {
      transformer: "postcss",
      preprocessorOptions: {
        css: {},
      },
    },
  };
});
