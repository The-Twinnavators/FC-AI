import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom gives tests a browser page, so screens can be rendered and clicked or typed into.
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    // describe, it, expect and beforeEach without imports, as most tests are written (No BIO & GMO build: "Cannot find
    // name 'beforeEach'" sent a step round in circles).
    globals: true,
    // Acceptance tests drive real interactions (typing, dialogs, navigation); 5 seconds cut some off mid-test, and a
    // test that times out leaves its screen behind for the next ones.
    testTimeout: 15_000,
  },
});
