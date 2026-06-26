import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const backendTarget = process.env.MOONBRIDGE_CONSOLE_BACKEND ?? "http://127.0.0.1:38440";

export default defineConfig({
  base: "/console/",
  plugins: [react()],
  server: {
    proxy: {
      "/api": backendTarget,
      "/v1": backendTarget,
      "/responses": backendTarget,
      "/models": backendTarget
    }
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://127.0.0.1:5173/console/"
      }
    },
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
});
