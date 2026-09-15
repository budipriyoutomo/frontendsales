"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IsiKartu } from "@/components/dashboard/states";
import { useTopProducts } from "@/hooks/use-sales";
import { formatAngka, formatRupiah } from "@/lib/format";
import type { Filter } from "@/lib/filter";
import type { TopProductRow } from "@/types/domain";

/**
 * Produk terlaris (TODO 4.5).
 *
 * Tabel, bukan grafik: tiap baris membawa lima hal (nama, grup, qty, omzet,
 * peringkat) dan batang hanya bisa menunjukkan satu di antaranya. Panjang
 * batang tipis di kolom omzet dipakai sebagai bantuan baca, bukan pengganti
 * angkanya.
 */
export function TopProducts({ filter }: { filter: Filter }) {
  const query = useTopProducts(filter, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Produk terlaris</CardTitle>
        <CardDescription>10 produk dengan omzet tertinggi</CardDescription>
      </CardHeader>
      <CardContent>
        <IsiKartu<TopProductRow[]>
          query={query}
          barisSkeleton={6}
          kosong={{
            judul: "Belum ada produk terjual",
            keterangan: "Tidak ada penjualan produk pada rentang tanggal ini.",
          }}
        >
          {(data) => {
            const tertinggi = Math.max(...data.map((p) => p.total_amount), 1);

            return (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Produk</TableHead>
                      <TableHead>Grup</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Omzet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((p, i) => (
                      <TableRow key={p.product_id}>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {i + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {p.product_name ?? `Produk #${p.product_id}`}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.product_group ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAngka(p.total_qty)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="tabular-nums">
                            {formatRupiah(p.total_amount)}
                          </span>
                          <span
                            aria-hidden
                            className="mt-1 block h-1 rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
                            style={{
                              width: `${Math.max(2, (p.total_amount / tertinggi) * 100)}%`,
                              marginLeft: "auto",
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          }}
        </IsiKartu>
      </CardContent>
    </Card>
  );
}
