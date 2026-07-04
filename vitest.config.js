import { defineConfig } from "vitest/config";

// Test unit frontend (logika murni: surveyPreview, exportSurvey, dll).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx}"],
  },
});
