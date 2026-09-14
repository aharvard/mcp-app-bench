import { defineConfig } from "@playwright/test"
export default defineConfig({
  testDir: "./browser-tests",
  timeout: 20000,
  use: {
    headless: true,
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
  },
  workers: 1,
})
