/**
 * Filter global dashboard (TODO 4.1) yang hidup di URL (TODO 4.8).
 *
 * Alasan menyimpannya di URL dan bukan di state React: laporan penjualan itu
 * sesuatu yang orang kirim ke orang lain ("lihat omzet OUT1 bulan Maret").
 * Kalau filter hanya di memori, tautannya tidak membawa apa-apa dan tombol
 * back tidak mengembalikan apa pun.
 */

export type Filter = {
  /** `yyyy-mm-dd` */
  start_date: string;
  /** `yyyy-mm-dd` */
  end_date: string;
  /** Tidak ada berarti semua outlet. */
  outlet?: string;
};

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `toISOString()` sengaja dihindari: fungsi itu mengubah ke UTC lebih dulu,
 * jadi jam 00:30 WIB akan tercatat sebagai tanggal kemarin.
 */
function keTanggalLokal(d: Date): string {
  const bulan = String(d.getMonth() + 1).padStart(2, "0");
  const hari = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${bulan}-${hari}`;
}

function tanggalSah(nilai: string | null): string | null {
  if (!nilai || !POLA_TANGGAL.test(nilai)) return null;

  // Pola saja tidak cukup — "2026-13-45" lolos regex tapi bukan tanggal.
  const [tahun, bulan, hari] = nilai.split("-").map(Number);
  const d = new Date(tahun, bulan - 1, hari);
  const cocok =
    d.getFullYear() === tahun &&
    d.getMonth() === bulan - 1 &&
    d.getDate() === hari;

  return cocok ? nilai : null;
}

export function rentangDefault(hariIni: Date = new Date()): {
  start_date: string;
  end_date: string;
} {
  const mulai = new Date(
    hariIni.getFullYear(),
    hariIni.getMonth(),
    hariIni.getDate() - 29,
  );

  return {
    start_date: keTanggalLokal(mulai),
    end_date: keTanggalLokal(hariIni),
  };
}

export function bacaFilter(
  params: URLSearchParams,
  hariIni: Date = new Date(),
): Filter {
  const def = rentangDefault(hariIni);

  let start_date = tanggalSah(params.get("start_date")) ?? def.start_date;
  let end_date = tanggalSah(params.get("end_date")) ?? def.end_date;

  // Rentang terbalik akan selalu mengembalikan nol baris, dan user akan
  // mengira datanya yang hilang. Dibetulkan diam-diam.
  if (start_date > end_date) [start_date, end_date] = [end_date, start_date];

  const outlet = params.get("outlet")?.trim();

  return { start_date, end_date, outlet: outlet ? outlet : undefined };
}

export function filterKeSearchParams(filter: Filter): URLSearchParams {
  const params = new URLSearchParams();
  params.set("start_date", filter.start_date);
  params.set("end_date", filter.end_date);
  if (filter.outlet) params.set("outlet", filter.outlet);
  return params;
}

/** Bentuk yang dipakai sebagai query string ke API. */
export function filterKeQuery(filter: Filter): Record<string, string> {
  const query: Record<string, string> = {
    start_date: filter.start_date,
    end_date: filter.end_date,
  };
  if (filter.outlet) query.outlet = filter.outlet;
  return query;
}
