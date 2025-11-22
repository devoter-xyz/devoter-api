import { defineConfig } from "vitest/config";
import path from 'node:path';

export default defineConfig({
  test: {
    setupFiles: ["./test/setup.ts"],
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "prisma/", "test/**", "**/*.test.*"],
    },
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
    },
  },
  transformMode: {
    web: [/\.js$/],
  },
});