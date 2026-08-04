import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/adapter-wati"],
  },
});
