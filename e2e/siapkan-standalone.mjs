/**
 * Menyiapkan keluaran `output: "standalone"` supaya bisa dijalankan langsung.
 *
 * `next build` menaruh server minimal di `.next/standalone/`, tapi aset statis
 * dan `public/` TIDAK ikut — Dockerfile menyalinnya sebagai langkah terpisah
 * (lihat 9.1). Untuk E2E lokal, langkah yang sama harus dilakukan, kalau tidak
 * halaman terbuka tanpa CSS dan tanpa JS.
 *
 * `fs.cpSync` dipakai supaya jalan sama di Windows dan Linux — `cp -r` tidak
 * ada di `cmd.exe`, dan Playwright memanggil shell bawaan sistem.
 */

import { cpSync, existsSync } from "node:fs";

const salinan = [
  [".next/static", ".next/standalone/.next/static"],
  ["public", ".next/standalone/public"],
];

for (const [dari, ke] of salinan) {
  if (!existsSync(dari)) {
    console.warn(`lewati: ${dari} tidak ada`);
    continue;
  }
  cpSync(dari, ke, { recursive: true });
  console.log(`disalin: ${dari} -> ${ke}`);
}
