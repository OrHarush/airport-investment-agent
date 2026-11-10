import { defineConfig } from "vitest/config";

// Tests that hit the DB need DATABASE_URL (server/.env is not where the app keeps it: ../.env is).
try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  /* env already provided by the shell/CI */
}

export default defineConfig({
  test: {
    globalSetup: ["./src/test/globalSetup.ts"],
    testTimeout: 60_000,
    hookTimeout: 300_000,
    // tools tests share one Postgres and write AirportScore snapshots
    fileParallelism: false,
  },
});
