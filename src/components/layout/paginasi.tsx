import { Button } from "@/components/ui/button";
import { formatAngka } from "@/lib/format";

/**
 * Baris paginasi di bawah tabel: "Halaman x dari y · n <satuan>" +
 * tombol Sebelumnya/Berikutnya. `onPindah` menerima offset baru.
 */
export function Paginasi({
  offset,
  limit,
  pagination,
  satuan,
  onPindah,
}: {
  offset: number;
  limit: number;
  pagination: { total: number; has_more: boolean } | undefined;
  /** Kata benda untuk total, mis. "transaksi". */
  satuan: string;
  onPindah: (offsetBaru: number) => void;
}) {
  const halaman = Math.floor(offset / limit) + 1;
  const totalHalaman = pagination
    ? Math.max(1, Math.ceil(pagination.total / limit))
    : 1;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground text-sm">
        {pagination
          ? `Halaman ${halaman} dari ${totalHalaman} · ${formatAngka(pagination.total)} ${satuan}`
          : null}
      </p>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={offset === 0}
          onClick={() => onPindah(Math.max(0, offset - limit))}
        >
          Sebelumnya
        </Button>
        <Button
          variant="outline"
          size="sm"
          // `has_more` datang dari server — jangan dihitung sendiri dari
          // panjang array, itu meleset di halaman terakhir.
          disabled={!pagination?.has_more}
          onClick={() => onPindah(offset + limit)}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}
