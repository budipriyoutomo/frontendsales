import { formatAngka } from "@/lib/format";

/** Selisih bertanda: "+2", "−15" (tanda minus tipografis), "0", atau "—". */
export function formatSelisih(nilai: number | null | undefined): string {
  if (nilai === null || nilai === undefined || !Number.isFinite(nilai)) {
    return "—";
  }
  if (nilai === 0) return "0";
  const angka = formatAngka(Math.abs(nilai));
  return nilai > 0 ? `+${angka}` : `−${angka}`;
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
