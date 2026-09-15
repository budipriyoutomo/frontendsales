/**
 * Pemformatan tampilan, Indonesia / `id-ID` (keputusan 0.4).
 *
 * Dikumpulkan di satu berkas supaya "Rp 4.418.375" dan "12 Sep 2026" ditulis
 * dengan cara yang sama di seluruh aplikasi — bukan sepuluh `toLocaleString`
 * yang perlahan berbeda satu sama lain.
 */

const LOCALE = "id-ID";

const rupiah = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const angka = new Intl.NumberFormat(LOCALE);

const tanggalPendek = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const tanggalWaktu = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * `Intl` menyisipkan U+00A0 setelah "Rp". Diganti spasi biasa supaya pencarian
 * teks di test dan penyalinan oleh user tidak tersandung karakter tak terlihat.
 */
function rapikan(teks: string): string {
  return teks.replace(/ /g, " ");
}

export function formatRupiah(nilai: number | null | undefined): string {
  if (nilai === null || nilai === undefined || !Number.isFinite(nilai)) {
    // Lebih jujur daripada "Rp 0", yang terbaca seolah omzetnya memang nol.
    return "—";
  }
  return rapikan(rupiah.format(nilai));
}

export function formatAngka(nilai: number | null | undefined): string {
  if (nilai === null || nilai === undefined || !Number.isFinite(nilai)) {
    return "—";
  }
  return rapikan(angka.format(nilai));
}

function keTanggal(nilai: string | Date | null | undefined): Date | null {
  if (!nilai) return null;
  const d = nilai instanceof Date ? nilai : new Date(nilai);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatTanggal(nilai: string | Date | null | undefined): string {
  const d = keTanggal(nilai);
  // Outlet yang belum pernah sync tidak boleh merender tanggal kosong (7.5).
  return d ? rapikan(tanggalPendek.format(d)) : "—";
}

export function formatTanggalWaktu(
  nilai: string | Date | null | undefined,
): string {
  const d = keTanggal(nilai);
  return d ? rapikan(tanggalWaktu.format(d)) : "—";
}

/**
 * Lama tunggu dalam bahasa manusia, untuk pesan `429` (TODO 2.6).
 * "Coba lagi dalam 5 menit" jauh lebih berguna daripada "login gagal".
 */
export function formatDurasiTunggu(detik: number): string {
  const total = Math.max(0, Math.ceil(detik));

  if (total < 60) return `${total} detik`;

  const menit = Math.floor(total / 60);
  const sisa = total % 60;

  return sisa === 0 ? `${menit} menit` : `${menit} menit ${sisa} detik`;
}
