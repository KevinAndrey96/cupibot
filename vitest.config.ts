import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
    testTimeout: 10_000,
    coverage: {
      provider: "v8",
      include: [
        "src/application/**/*.ts",
        "src/config/**/*.ts",
        "src/domain/**/*.ts",
        "src/composition/**/*.ts",
      ],
      exclude: [
        "src/**/*.d.ts",
      ],
      thresholds: {
        lines: 45,
        functions: 45,
        branches: 40,
        statements: 45,
      },
    },
  },
});
