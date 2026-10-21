import { defineConfig, devices } from "@playwright/test";

// Browser tests run against the production build served by `vite preview`. The /api
// proxy only executes under the Vercel runtime, so each test mocks it at the network
// layer (page.route); the proxy and backend have their own unit tests.
// Files are *.e2e.js so vitest's default *.test/*.spec glob never picks them up.
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.js",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
