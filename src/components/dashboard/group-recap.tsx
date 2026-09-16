"use client";

import { Button } from "@/components/ui/button";
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
import {
  IsiKartu,
  KartuSkeleton,
  KeadaanGagal,
  KeadaanKosong,
} from "@/components/dashboard/states";
import { useSalesByGroup, useSalesProductGroups } from "@/hooks/use-sales";
import { formatAngka, formatTanggal } from "@/lib/format";
import type { Filter } from "@/lib/filter";
import type { ProductGroupSalesRow } from "@/types/domain";

/**
 * Rekap qty terjual per product group (TODO 10.9–10.10).
 *
 * Pilihan group dipegang pemanggil (disimpan di URL, 10.12); komponen ini
 * hanya menampilkan dan melaporkan perubahannya.
 */
export function GroupRecap({
  filter,
  terpilih,
  onTerpilihChange,
}: {
  filter: Filter;
  terpilih: readonly string[];
  onTerpilihChange: (groups: string[]) => void;
}) {
  const daftar = useSalesProductGroups(filter.outlet);
  const rekap = useSalesByGroup(filter, terpilih);

  // Group dari URL yang tidak ada di data outlet ini tetap ditampilkan,
  // supaya masih bisa dilepas — bukan tersangkut tak terlihat.
  const pilihan = [
    ...(daftar.data ?? []),
    ...terpilih.filter((g) => !(daftar.data ?? []).includes(g)),
  ];

  function alihkan(group: string) {
    onTerpilihChange(
      terpilih.includes(group)
        ? terpilih.filter((g) => g !== group)
        : [...terpilih, group],
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Rekap per product group</CardTitle>
        <CardDescription>
          Qty terjual per produk, outlet, dan tanggal. Transaksi void ikut
          terhitung, jadi angkanya bisa berbeda dengan kartu ringkasan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <p id="pilih-group" className="text-sm font-medium">
            Pilih group
          </p>
          {daftar.isPending ? (
            <KartuSkeleton baris={1} />
          ) : pilihan.length === 0 ? (
            daftar.isError ? (
              <KeadaanGagal error={daftar.error} onCobaLagi={daftar.refetch} />
            ) : (
              <p className="text-muted-foreground text-sm">
                Belum ada product group di data penjualan.
              </p>
            )
          ) : (
            <>
              <div
                role="group"
                aria-labelledby="pilih-group"
                className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto"
              >
                {pilihan.map((g) => {
                  const aktif = terpilih.includes(g);
                  return (
                    <Button
                      key={g}
                      type="button"
                      size="sm"
                      variant={aktif ? "default" : "outline"}
                      aria-pressed={aktif}
                      className="font-mono"
                      onClick={() => alihkan(g)}
                    >
                      {g}
                    </Button>
                  );
                })}
              </div>
              {/* Daftarnya gagal dimuat, tapi chip pilihan tetap dirender:
                  rekap di bawah memakainya, jadi harus ada cara melepasnya. */}
              {daftar.isError ? (
                <p role="alert" className="text-muted-foreground text-xs">
                  Daftar group gagal dimuat, jadi hanya pilihan Anda yang
                  tampil.{" "}
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => daftar.refetch()}
                  >
                    Muat ulang daftar
                  </Button>
                </p>
              ) : null}
            </>
          )}
        </div>

        {terpilih.length === 0 ? (
          <KeadaanKosong
            judul="Belum ada group terpilih"
            keterangan="Pilih satu atau lebih group di atas untuk melihat rekapnya."
          />
        ) : (
          <IsiKartu<ProductGroupSalesRow[]>
            query={rekap}
            barisSkeleton={5}
            kosong={{
              judul: "Tidak ada penjualan untuk group terpilih",
              keterangan: "Coba rentang tanggal atau group yang lain.",
            }}
          >
            {(data) => (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group</TableHead>
                      <TableHead>Produk</TableHead>
                      <TableHead>Outlet</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead className="text-right">Terjual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((r, i) => (
                      <TableRow
                        key={`${r.product_group}|${r.product_name}|${r.outlet_code}|${r.sale_date}|${i}`}
                      >
                        <TableCell className="font-mono text-xs">
                          {r.product_group}
                        </TableCell>
                        <TableCell className="font-medium">
                          {r.product_name ?? "—"}
                        </TableCell>
                        <TableCell>{r.outlet_code ?? "—"}</TableCell>
                        <TableCell>{formatTanggal(r.sale_date)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAngka(r.sold)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </IsiKartu>
        )}
      </CardContent>
    </Card>
  );
}
