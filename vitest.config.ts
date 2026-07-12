import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // exclude を上書きするとデフォルト除外(**/node_modules/** 等)が消えるため、
    // 必要な除外をすべて明示する。infra は自前の vitest(cd infra && npm test)を持つ。
    exclude: ["e2e/**", "**/node_modules/**", "infra/**", "out/**", ".next/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
