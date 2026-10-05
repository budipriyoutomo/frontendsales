import { formatAngka } from "@/lib/format";
import type { ClosingComparisonRow } from "@/types/domain";

/**
 * Status baris perbandingan closing vs POS (backend TODO Fase 7.6).
 *
 * `nada` dipakai untuk warna badge; label tetap menyebut statusnya supaya
 * maknanya tidak hanya disampaikan lewat warna.
 */
export const STATUS_PERBANDINGAN = {
  cocok: { label: "Cocok", nada: "baik" },
  selisih: { label: "Selisih", nada: "buruk" },
  belum_dipetakan: { label: "Belum dipetakan", nada: "peringatan" },
  tidak_ada_di_closing: { label: "Tidak ada di closing", nada: "buruk" },
} as const;

export type StatusPerbandingan = keyof typeof STATUS_PERBANDINGAN;

/** Pilihan saring tambahan: semua selain `cocok`. */
export const BERMASALAH = "bermasalah";
export type SaringStatus = StatusPerbandingan | typeof BERMASALAH;

export function statusDikenal(status: string): status is StatusPerbandingan {
  return status in STATUS_PERBANDINGAN;
}

export function hitungPerStatus(
  baris: ClosingComparisonRow[],
): Record<StatusPerbandingan, number> {
  const hasil: Record<StatusPerbandingan, number> = {
    cocok: 0,
    selisih: 0,
    belum_dipetakan: 0,
    tidak_ada_di_closing: 0,
  };
  for (const b of baris) {
    if (statusDikenal(b.status)) hasil[b.status] += 1;
  }
  return hasil;
}

export function saringPerbandingan(
  baris: ClosingComparisonRow[],
  status: SaringStatus | undefined,
): ClosingComparisonRow[] {
  if (!status) return baris;
  if (status === BERMASALAH) return baris.filter((b) => b.status !== "cocok");
  return baris.filter((b) => b.status === status);
}

/** Selisih bertanda: "+2", "−15" (tanda minus tipografis), "0", atau "—". */
export function formatSelisih(nilai: number | null | undefined): string {
  if (nilai === null || nilai === undefined || !Number.isFinite(nilai)) {
    return "—";
  }
  if (nilai === 0) return "0";
  const angka = formatAngka(Math.abs(nilai));
  return nilai > 0 ? `+${angka}` : `−${angka}`;
}
