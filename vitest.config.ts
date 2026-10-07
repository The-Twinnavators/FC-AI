import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    exclude: ["**/fixtures/**", "**/node_modules/**"],
    testTimeout: 60_000,
    pool: "forks"
  }
});
