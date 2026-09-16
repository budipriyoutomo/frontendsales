/**
 * Aturan product group di sisi tampilan (TODO Fase 10).
 *
 * Backend yang memutuskan bentuk akhir nama group; fungsi di sini hanya
 * **meniru** aturannya, supaya pratinjau "akan tersimpan sebagai …" dan
 * saran group tidak menjanjikan sesuatu yang berbeda dari yang tersimpan.
 */

/** Sama dengan `MAX_PRODUCT_GROUP_LENGTH` di backend (kolom "Group"). */
export const PANJANG_GROUP_MAKSIMAL = 255;

/** Nama param URL untuk group terpilih di rekap per group. */
export const PARAM_GROUP_REKAP = "product_group";

/** Nama param URL untuk filter group di Produk terlaris. */
export const PARAM_GROUP_TERLARIS = "top_product_group";

/**
 * Tanpa spasi di ujung, huruf besar.
 *
 * Sengaja hanya SPASI, bukan semua whitespace: backend memakai `strip(" ")`
 * supaya cocok dengan `UPPER(TRIM("Group"))` di SQL. `String.trim()` akan
 * membuang tab juga, dan pratinjaunya jadi berbohong.
 */
export function normalisasiGroup(nama: string): string {
  return nama.replace(/^ +| +$/g, "").toUpperCase();
}

export function validasiNamaGroup(nama: string): string | null {
  const normal = normalisasiGroup(nama);

  if (normal === "") return "Nama group wajib diisi.";
  if (normal.length > PANJANG_GROUP_MAKSIMAL) {
    return `Nama group maksimal ${PANJANG_GROUP_MAKSIMAL} karakter.`;
  }
  return null;
}

/**
 * Group yang ada di data penjualan tapi belum terdaftar untuk dipublish.
 *
 * Yang sudah terdaftar dikeluarkan walau sedang nonaktif — menambahkannya
 * lagi pasti ditolak 409; jalannya adalah mengaktifkan dari daftar.
 */
export function saranGroup(
  diData: readonly string[],
  terdaftar: readonly { product_group: string }[],
): string[] {
  const sudah = new Set(
    terdaftar.map((m) => normalisasiGroup(m.product_group)),
  );
  const hasil = new Set<string>();

  for (const nama of diData) {
    const normal = normalisasiGroup(nama);
    if (normal !== "" && !sudah.has(normal)) hasil.add(normal);
  }

  return [...hasil].sort((a, b) => a.localeCompare(b));
}

/** Group terpilih dari URL (TODO 10.12) — bentuk normal, tanpa duplikat. */
export function bacaGroupTerpilih(
  params: URLSearchParams,
  kunci: string = PARAM_GROUP_REKAP,
): string[] {
  const hasil = new Set<string>();
  for (const nilai of params.getAll(kunci)) {
    const normal = normalisasiGroup(nilai);
    if (normal !== "") hasil.add(normal);
  }
  return [...hasil];
}

/**
 * Salinan `params` dengan `kunci` diganti `nilai` (param berulang).
 * Param lain dibiarkan — rentang tanggal dan outlet ikut terbawa.
 */
export function gantiParam(
  params: URLSearchParams,
  kunci: string,
  nilai: readonly string[],
): URLSearchParams {
  const hasil = new URLSearchParams(params);
  hasil.delete(kunci);
  for (const v of nilai) hasil.append(kunci, v);
  return hasil;
}
