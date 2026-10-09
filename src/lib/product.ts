/**
 * Aturan master data product di sisi tampilan.
 *
 * Sama seperti brand: backend yang memutuskan bentuk akhir, fungsi di sini
 * hanya meniru `normalize_product_code` supaya pratinjau "akan tersimpan
 * sebagai …" tidak menjanjikan sesuatu yang berbeda.
 *
 * Wajib: ProductID (`code`), Product Code, nama, dan brand. Sisanya opsional.
 */

/** Sama dengan konstanta `MAX_*` di `product_service` backend. */
export const PANJANG_KODE_PRODUK_MAKSIMAL = 50;
export const PANJANG_NAMA_PRODUK_MAKSIMAL = 255;
export const PANJANG_KATEGORI_MAKSIMAL = 100;
export const PANJANG_SUBKATEGORI_MAKSIMAL = 100;

/** Tanpa SPASI di ujung, huruf besar — sama dengan `strip(" ").upper()`. */
export function normalisasiKodeProduk(kode: string): string {
  return kode.replace(/^ +| +$/g, "").toUpperCase();
}

/** ProductID dan Product Code memakai aturan yang sama; `label` untuk pesannya. */
export function validasiKodeProduk(
  kode: string,
  label = "ProductID",
): string | null {
  const normal = normalisasiKodeProduk(kode);

  if (normal === "") return `${label} wajib diisi.`;
  if (normal.length > PANJANG_KODE_PRODUK_MAKSIMAL) {
    return `${label} maksimal ${PANJANG_KODE_PRODUK_MAKSIMAL} karakter.`;
  }
  return null;
}

export function validasiNamaProduk(nama: string): string | null {
  const bersih = nama.trim();

  if (bersih === "") return "Nama produk wajib diisi.";
  if (bersih.length > PANJANG_NAMA_PRODUK_MAKSIMAL) {
    return `Nama produk maksimal ${PANJANG_NAMA_PRODUK_MAKSIMAL} karakter.`;
  }
  return null;
}

export function validasiTeksOpsional(
  teks: string,
  label: string,
  maksimal: number,
): string | null {
  if (teks.trim().length > maksimal) {
    return `${label} maksimal ${maksimal} karakter.`;
  }
  return null;
}
