import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const database = path.join(__dirname, "server/data/playwright.sqlite");

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://127.0.0.1:3010",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `rm -f "${database}" "${database}-wal" "${database}-shm" && npm run start -w @scheduler/server`,
      url: "http://127.0.0.1:4010/rooms",
      env: { PORT: "4010", DB_PATH: database },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm exec -w @scheduler/client -- next dev --port 3010",
      url: "http://127.0.0.1:3010",
      env: { API_ORIGIN: "http://127.0.0.1:4010" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
