import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

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
    ],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
        "@components": resolve(__dirname, "src/components"),
        "@pages": resolve(__dirname, "src/pages"),
        "@contexts": resolve(__dirname, "src/contexts"),
        "@hooks": resolve(__dirname, "src/hooks"),
        "@services": resolve(__dirname, "src/services"),
        "@utils": resolve(__dirname, "src/utils"),
      },
    },
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
