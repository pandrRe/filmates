import { defineConfig, devices } from "@playwright/test";

const BASE_URL = "http://localhost:5199";

export default defineConfig({
  testDir: "tests",
  fullyParallel: false,
  use: {
    baseURL: BASE_URL,
    ...devices["Desktop Chrome"],
    viewport: { width: 375, height: 812 },
    permissions: ["clipboard-read", "clipboard-write"],
  },
  webServer: {
    command: "pnpm exec vite --port 5199",
    url: BASE_URL,
    reuseExistingServer: true,
  },
});
