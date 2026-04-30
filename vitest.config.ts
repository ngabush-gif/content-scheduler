import { defineConfig } from "vitest/config";
import path from "path";

// Safely determine templateRoot - handle ESM import.meta.dirname being undefined
const templateRoot = path.resolve(import.meta.dirname || process.cwd());

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "client/**/*.test.ts",
      "client/**/*.spec.ts",
    ],
  },
});
