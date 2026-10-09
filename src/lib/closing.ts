import { formatAngka } from "@/lib/format";
import type { ClosingComparisonRow } from "@/types/domain";

/** Selisih bertanda: "+2", "−15" (tanda minus tipografis), "0", atau "—". */
export function formatSelisih(nilai: number | null | undefined): string {
  if (nilai === null || nilai === undefined || !Number.isFinite(nilai)) {
    return "—";
  }
  if (nilai === 0) return "0";
  const angka = formatAngka(Math.abs(nilai));
  return nilai > 0 ? `+${angka}` : `−${angka}`;
}

export type TotalBaris = {
  sold: number;
  waste: number;
  adjustment: number;
  compensation: number;
};

/**
 * Kolom Total di perbandingan Colorplate vs POS: Total Sold = Colorplate
 * terjual + qty POS. POS tidak punya waste / adjustment / kompensasi, jadi
 * ketiganya dari Colorplate saja. Angka yang kosong (menu belum dipetakan,
 * atau baris yang hanya ada di POS) dihitung 0.
 */
export function totalBaris(baris: ClosingComparisonRow): TotalBaris {
  const n = (nilai: number | null | undefined) => nilai ?? 0;
  return {
    sold: n(baris.sold) + n(baris.pos_qty),
    waste: n(baris.waste),
    adjustment: n(baris.adjustment),
    compensation: n(baris.compensation),
  };
}

/**
 * Status log pesan RabbitMQ (`/api/closing-messages`, migrasi backend 013).
 * Semua selain `ditolak` sudah tersimpan dan di-ack; `ditolak` masuk DLQ.
 */
export const STATUS_PESAN = {
  baru: { label: "Baru", nada: "baik" },
  revisi: { label: "Revisi", nada: "baik" },
  revisi_lama: { label: "Revisi lama", nada: "peringatan" },
  duplikat: { label: "Duplikat", nada: "netral" },
  ditolak: { label: "Ditolak", nada: "buruk" },
} as const;

export type StatusPesan = keyof typeof STATUS_PESAN;

export const URUTAN_STATUS_PESAN: readonly StatusPesan[] = [
  "baru",
  "duplikat",
  "revisi",
  "revisi_lama",
  "ditolak",
];

/** `["data", "items", 0, "sold"]` → `data.items[0].sold` (lokasi error Pydantic). */
export function formatLokasiError(loc: unknown): string {
  if (!Array.isArray(loc) || loc.length === 0) return "(pesan)";
  return loc
    .map((bagian, i) =>
      typeof bagian === "number"
        ? `[${bagian}]`
        : i === 0
          ? String(bagian)
          : `.${String(bagian)}`,
    )
    .join("");
}

export function formatJson(nilai: unknown): string {
  return JSON.stringify(nilai, null, 2);
}
