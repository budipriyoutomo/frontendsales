import { ApiError } from "./client";

/**
 * 503 (backend sibuk / query kena batas waktu) dan 504 (BFF berhenti
 * menunggu) berarti server sudah kewalahan atau query-nya memang terlalu
 * berat. Mengulangnya otomatis hanya melipatgandakan beban — biar user yang
 * memutuskan, misalnya setelah mempersempit rentang tanggal.
 */
const TIDAK_DIULANG = new Set([503, 504]);

/** Kebijakan `retry` default TanStack Query. */
export function bolehDiulang(failureCount: number, error: unknown): boolean {
  // 4xx tidak akan berubah kalau diulang — hanya 5xx dan gangguan jaringan
  // yang layak dicoba lagi. 401 sudah ditangani proxy BFF.
  if (error instanceof ApiError) {
    if (error.status < 500 || TIDAK_DIULANG.has(error.status)) return false;
  }
  return failureCount < 2;
}
