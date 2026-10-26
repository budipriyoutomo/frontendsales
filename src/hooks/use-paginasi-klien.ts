"use client";

import { useState } from "react";

export const LIMIT_KLIEN = 50;

/**
 * Paginasi di klien untuk daftar yang sudah dimuat utuh — dipakai halaman
 * yang datanya kecil atau butuh daftar lengkap untuk keperluan lain (saran,
 * pengecekan, ringkasan). Hasilnya berbentuk sama dengan props `Paginasi`.
 *
 * `kunciReset` berubah (mis. filter baru) → kembali ke halaman pertama.
 */
export function usePaginasiKlien<T>(
  semua: readonly T[],
  {
    limit = LIMIT_KLIEN,
    kunciReset,
  }: { limit?: number; kunciReset?: string } = {},
) {
  const [offset, setOffset] = useState(0);
  const [kunci, setKunci] = useState(kunciReset);
  if (kunci !== kunciReset) {
    setKunci(kunciReset);
    setOffset(0);
  }

  // Daftar menyusut setelah refetch → jangan terdampar di halaman kosong.
  const offsetTerakhir = Math.max(
    0,
    Math.floor((semua.length - 1) / limit) * limit,
  );
  const aman = kunci !== kunciReset ? 0 : Math.min(offset, offsetTerakhir);

  return {
    halaman: semua.slice(aman, aman + limit),
    offset: aman,
    limit,
    pagination: { total: semua.length, has_more: aman + limit < semua.length },
    setOffset,
  };
}
