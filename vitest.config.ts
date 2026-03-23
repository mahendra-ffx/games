import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    typecheck: { tsconfig: "./tsconfig.test.json" },
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      exclude: [
        "node_modules/**",
        ".next/**",
        "**/*.config.*",
        "**/*.d.ts",
        "public/**",
        "agents/**",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
      },
    },
    include: ["**/__tests__/unit/**/*.test.{ts,tsx}", "**/__tests__/integration/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
