import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/browser.spec.js',
  fullyParallel: false,
  workers: 1,
  use: { channel: 'chrome', viewport: { width: 390, height: 844 }, baseURL: 'http://127.0.0.1:5173/JorrelWorksOut/' },
  webServer: [
    { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173/JorrelWorksOut/', reuseExistingServer: false },
    { command: 'npm run build && npm run preview -- --host 127.0.0.1', url: 'http://127.0.0.1:4173/JorrelWorksOut/', reuseExistingServer: false },
  ],
})
