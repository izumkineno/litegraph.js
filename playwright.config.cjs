const { defineConfig, devices } = require("@playwright/test");

if (!process.env.NO_PROXY) {
  process.env.NO_PROXY = "127.0.0.1,localhost";
} else if (!process.env.NO_PROXY.includes("127.0.0.1")) {
  process.env.NO_PROXY = `${process.env.NO_PROXY},127.0.0.1,localhost`;
}
process.env.no_proxy = process.env.NO_PROXY;

module.exports = defineConfig({
  testDir: "./tests/playwright/specs",
  testMatch: /.*\.spec\.cjs$/,
  timeout: 120000,
  expect: {
    timeout: 10000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: require.resolve("./tests/playwright/global.setup.cjs"),
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: process.env.PW_HEADED ? false : true,
  },
  webServer: {
    command: "node tests/playwright/static-server.cjs",
    port: 4173,
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  outputDir: "test-results/playwright",
});
