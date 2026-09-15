/**
 * Nama cookie sesi, dipisah dari `session.ts` dengan sengaja.
 *
 * `session.ts` bergantung pada `next/headers` dan ditandai `server-only`,
 * sedangkan `proxy.ts` berjalan di lapisan lain dan hanya perlu tahu namanya.
 * Kalau konstanta ini ikut di sana, proxy akan menyeret seluruh modul server.
 */
export const ACCESS_COOKIE = "mh_at";
export const REFRESH_COOKIE = "mh_rt";
