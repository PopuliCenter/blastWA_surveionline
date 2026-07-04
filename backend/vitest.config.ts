import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // Env valid agar modul yang mengimpor env.ts (mis. crypto) bisa dimuat saat test.
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      JWT_SECRET: "test_jwt_secret_minimal_32_characters",
      CREDENTIALS_ENC_KEY: "0".repeat(64),
      ERROR_LOG_FILE: "./logs/test-error.log",
    },
  },
});
