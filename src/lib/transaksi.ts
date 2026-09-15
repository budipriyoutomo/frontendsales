import type { Sale, SaleDetail } from "@/types/domain";

/**
 * Penanda transaksi void (TODO 5.5).
 *
 * Memakai kolom `Deleted` — kolom yang sama yang dipakai endpoint laporan
 * untuk mengecualikan baris. Itu penting: kalau tabel dan kartu ringkasan
 * memakai penanda yang berbeda, keduanya akan menampilkan kenyataan yang
 * berbeda tentang struk yang sama.
 *
 * Sempat memakai `void_staff_id != 0` selama backend belum mengekspos
 * `Deleted`. Itu kolom lain dengan arti lain — seorang staf bisa tercatat
 * mem-void satu item tanpa seluruh struk dibatalkan.
 */
export function transaksiVoid(sale: Sale | SaleDetail): boolean {
  // `?? 0`: response backend versi lama belum membawa kolom ini, dan tidak
  // adanya penanda berarti "tidak void", bukan "tidak diketahui".
  return (sale.deleted ?? 0) !== 0;
}
