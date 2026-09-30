/**
 * Aturan kode brand di sisi tampilan.
 *
 * Sama seperti product group: backend yang memutuskan bentuk akhir, fungsi di
 * sini hanya meniru `normalize_brand_code` supaya pratinjau "akan tersimpan
 * sebagai …" tidak menjanjikan sesuatu yang berbeda.
 */

/** Sama dengan `MAX_BRAND_CODE_LENGTH` di backend (panjang `outlet_code`). */
export const PANJANG_KODE_BRAND_MAKSIMAL = 20;
export const PANJANG_NAMA_BRAND_MAKSIMAL = 255;

/** Tanpa SPASI di ujung, huruf besar — sama dengan `strip(" ").upper()`. */
export function normalisasiKodeBrand(kode: string): string {
  return kode.replace(/^ +| +$/g, "").toUpperCase();
}

export function validasiKodeBrand(kode: string): string | null {
  const normal = normalisasiKodeBrand(kode);

  if (normal === "") return "Kode brand wajib diisi.";
  if (normal.length > PANJANG_KODE_BRAND_MAKSIMAL) {
    return `Kode brand maksimal ${PANJANG_KODE_BRAND_MAKSIMAL} karakter.`;
  }
  return null;
}

export function validasiNamaBrand(nama: string): string | null {
  const bersih = nama.trim();

  if (bersih === "") return "Nama brand wajib diisi.";
  if (bersih.length > PANJANG_NAMA_BRAND_MAKSIMAL) {
    return `Nama brand maksimal ${PANJANG_NAMA_BRAND_MAKSIMAL} karakter.`;
  }
  return null;
}
