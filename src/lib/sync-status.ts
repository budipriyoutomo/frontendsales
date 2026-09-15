import type { SyncStatusRow } from "@/types/domain";

/**
 * Kesegaran data per outlet (TODO 7.2).
 *
 * Halaman ini yang paling berguna secara operasional: outlet yang diam
 * berarti omzetnya hilang dari laporan, dan tidak ada satu pun yang memberi
 * tahu. Ambangnya sengaja punya tingkat menengah — langsung melompat dari
 * "normal" ke "mati" membuat orang mengabaikan alarmnya.
 */

/** Di bawah ini masih wajar: POS bisa saja tutup beberapa jam. */
export const AMBANG_WASPADA_JAM = 6;
/** Di atas ini hampir pasti ada yang salah — POS mati atau jaringan putus. */
export const AMBANG_BASI_JAM = 24;

export type Kesegaran = "segar" | "waspada" | "basi" | "belum-pernah";

export function nilaiKesegaran(
  row: Pick<SyncStatusRow, "last_synced_at">,
  sekarang: Date = new Date(),
): Kesegaran {
  if (!row.last_synced_at) return "belum-pernah";

  const terakhir = new Date(row.last_synced_at);
  if (Number.isNaN(terakhir.getTime())) return "belum-pernah";

  const selisihJam =
    (sekarang.getTime() - terakhir.getTime()) / (1000 * 60 * 60);

  // Jam POS yang meleset ke depan menghasilkan selisih negatif — itu bukan
  // alasan untuk membunyikan alarm.
  if (selisihJam <= AMBANG_WASPADA_JAM) return "segar";
  if (selisihJam <= AMBANG_BASI_JAM) return "waspada";
  return "basi";
}

export function labelKesegaran(k: Kesegaran): string {
  switch (k) {
    case "segar":
      return "Normal";
    case "waspada":
      return "Perlu dicek";
    case "basi":
      return "Tidak mengirim data";
    case "belum-pernah":
      return "Belum pernah sync";
  }
}

/**
 * Varian badge shadcn per keadaan. Warna tidak pernah jadi satu-satunya
 * penanda — label teks di atas selalu ikut ditampilkan.
 */
export function varianBadge(
  k: Kesegaran,
): "default" | "secondary" | "destructive" | "outline" {
  switch (k) {
    case "segar":
      return "secondary";
    case "waspada":
      return "default";
    case "basi":
      return "destructive";
    case "belum-pernah":
      return "outline";
  }
}

/** Yang bermasalah muncul lebih dulu — itu alasan halaman ini dibuka. */
export function urutkanMendesak(
  rows: SyncStatusRow[],
  sekarang: Date = new Date(),
): SyncStatusRow[] {
  const prioritas: Record<Kesegaran, number> = {
    basi: 0,
    "belum-pernah": 1,
    waspada: 2,
    segar: 3,
  };

  return [...rows].sort((a, b) => {
    const beda =
      prioritas[nilaiKesegaran(a, sekarang)] -
      prioritas[nilaiKesegaran(b, sekarang)];
    if (beda !== 0) return beda;
    return (a.outlet_code ?? "").localeCompare(b.outlet_code ?? "");
  });
}
