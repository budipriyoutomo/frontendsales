"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KartuSkeleton, KeadaanGagal } from "@/components/dashboard/states";
import { useSummary } from "@/hooks/use-sales";
import { formatAngka, formatRupiah } from "@/lib/format";
import type { Filter } from "@/lib/filter";

/**
 * Kartu ringkasan (TODO 4.2).
 *
 * Bentuknya stat tile, bukan grafik: empat angka headline tidak jadi lebih
 * jelas kalau dijadikan batang.
 *
 * Catatan angka: omzet memakai `ReceiptPayPrice` — yang benar-benar dibayar.
 * Kolom `ReceiptTotalAmount` tampak seperti uang tapi isinya jumlah item;
 * ini yang dulu membuat ringkasan menampilkan Rp 109 (lihat TODO 0.5).
 */
export function SummaryCards({ filter }: { filter: Filter }) {
  const query = useSummary(filter);

  if (query.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <KartuSkeleton baris={2} />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <Card>
        <CardContent>
          <KeadaanGagal error={query.error} onCobaLagi={query.refetch} />
        </CardContent>
      </Card>
    );
  }

  const d = query.data;
  const adaTransaksi = (d?.total_transactions ?? 0) > 0;

  const kartu = [
    {
      judul: "Omzet",
      nilai: adaTransaksi ? formatRupiah(d?.total_amount) : "—",
      catatan: "Total yang dibayar pelanggan",
    },
    {
      judul: "Transaksi",
      nilai: formatAngka(d?.total_transactions),
      catatan: "Jumlah struk",
    },
    {
      judul: "Diskon",
      nilai: adaTransaksi ? formatRupiah(d?.total_discount) : "—",
      catatan: "Total potongan",
    },
    {
      judul: "Rata-rata per struk",
      nilai: adaTransaksi ? formatRupiah(d?.average_per_transaction) : "—",
      catatan: "Omzet dibagi jumlah struk",
    },
  ];

  return (
    <div
      className={
        query.isFetching
          ? "grid gap-4 opacity-60 transition-opacity sm:grid-cols-2 xl:grid-cols-4"
          : "grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-4"
      }
    >
      {kartu.map((k) => (
        <Card key={k.judul}>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              {k.judul}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {/* Angka besar pakai figur proporsional — `tabular-nums` hanya
                untuk kolom yang harus sejajar vertikal. */}
            <p className="text-2xl font-semibold tracking-tight">{k.nilai}</p>
            <p className="text-muted-foreground text-xs">
              {adaTransaksi
                ? k.catatan
                : "Belum ada transaksi pada rentang ini"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
