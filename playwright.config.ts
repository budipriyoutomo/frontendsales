import { defineConfig, devices } from "@playwright/test";

/**
 * Konfigurasi E2E (TODO 8.1–8.3).
 *
 * Dua server dinyalakan Playwright sendiri: backend tiruan yang meniru
 * kontrak FastAPI, lalu aplikasi Next yang menunjuk ke sana lewat
 * `API_BASE_URL`. Dengan begitu seluruh lapisan frontend ikut teruji —
 * `proxy.ts`, Route Handler, cookie httpOnly, refresh 401 — tanpa menuntut
 * Postgres dan user ter-seed di CI.
 */

const MOCK_PORT = 8788;
const APP_PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Satu worker: backend tiruan menyimpan state (API key, user) di memori,
  // jadi test yang jalan bersamaan akan saling menimpa.
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: "on-first-retry",
    video: "retain-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: [
    {
      command: "node e2e/mock-backend.mjs",
      port: MOCK_PORT,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      env: { MOCK_PORT: String(MOCK_PORT) },
    },
    {
      // Build produksi, bukan `next dev`: yang dikirim ke pengguna adalah
      // hasil build, dan perbedaan keduanya justru yang ingin ditangkap.
      //
      // Dijalankan lewat `node .next/standalone/server.js`, BUKAN
      // `next start` — dengan `output: "standalone"` Next menolak `next start`
      // dan memperingatkannya. Ini sekaligus membuat E2E menguji artefak yang
      // persis sama dengan yang masuk ke image Docker (9.1).
      command:
        "npm run build && node e2e/siapkan-standalone.mjs && node .next/standalone/server.js",
      port: APP_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "pipe",
      env: {
        API_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
        NODE_ENV: "production",
        // `server.js` standalone membaca port dari env, bukan argumen CLI.
        PORT: String(APP_PORT),
        HOSTNAME: "127.0.0.1",
      },
    },
  ],
});
