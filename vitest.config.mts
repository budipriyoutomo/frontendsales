import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      // Provider istanbul, bukan v8: `@vitest/coverage-v8` menuntut Node >= 22
      // sedangkan proyek ini berjalan di Node 20.
      provider: "istanbul",
      reporter: ["text", "html"],
      /**
       * Ambang hanya untuk `lib/` dan `hooks/` (TODO 8.5).
       *
       * Di sanalah logika yang bisa salah diam-diam tinggal — pemformatan
       * rupiah, pembacaan filter, ambang kesegaran sync, pagar hak akses.
       * Komponen diuji lewat perilakunya, bukan lewat angka cakupan.
       */
      include: ["src/lib/**/*.ts", "src/hooks/**/*.ts"],
      exclude: [
        "src/lib/utils.ts",
        "**/*.test.ts",
        // Modul `server-only` yang memanggil `cookies()` — keduanya menuntut
        // konteks request Next dan tidak bisa dijalankan di jsdom sama sekali.
        // Jalurnya diverifikasi lewat uji langsung ke server yang berjalan,
        // bukan lewat unit test, jadi menghitungnya di sini hanya menghasilkan
        // angka yang menyesatkan.
        "src/lib/auth/session.ts",
        "src/lib/auth/current-user.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});
