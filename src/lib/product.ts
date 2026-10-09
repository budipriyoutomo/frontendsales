/**
 * Aturan master data product di sisi tampilan.
 *
 * Sama seperti brand: backend yang memutuskan bentuk akhir, fungsi di sini
 * hanya meniru `normalize_product_code` supaya pratinjau "akan tersimpan
 * sebagai …" tidak menjanjikan sesuatu yang berbeda.
 */

/** Sama dengan konstanta `MAX_*` di `product_service` backend. */
export const PANJANG_KODE_PRODUK_MAKSIMAL = 50;
export const PANJANG_NAMA_PRODUK_MAKSIMAL = 255;
export const PANJANG_KATEGORI_MAKSIMAL = 100;
export const PANJANG_SATUAN_MAKSIMAL = 20;

/** Tanpa SPASI di ujung, huruf besar — sama dengan `strip(" ").upper()`. */
export function normalisasiKodeProduk(kode: string): string {
  return kode.replace(/^ +| +$/g, "").toUpperCase();
}

export function validasiKodeProduk(kode: string): string | null {
  const normal = normalisasiKodeProduk(kode);

  if (normal === "") return "Kode produk wajib diisi.";
  if (normal.length > PANJANG_KODE_PRODUK_MAKSIMAL) {
    return `Kode produk maksimal ${PANJANG_KODE_PRODUK_MAKSIMAL} karakter.`;
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

/**
 * Harga rupiah dari input: kosong = 0. Hanya bilangan bulat tanpa pemisah —
 * "25.000" bisa berarti dua puluh lima ribu atau 25,000, jadi ditolak, bukan
 * ditebak. (Backend menerima desimal; dashboard tidak memerlukannya.)
 */
export function bacaHarga(teks: string): number | null {
  const bersih = teks.trim();
  if (bersih === "") return 0;
  if (!/^\d{1,14}$/.test(bersih)) return null;
  return Number(bersih);
}

export function validasiHarga(teks: string): string | null {
  return bacaHarga(teks) === null
    ? "Harga harus bilangan bulat ≥ 0 tanpa titik atau koma (mis. 25000)."
    : null;
}
