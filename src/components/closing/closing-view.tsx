"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterBar } from "@/components/dashboard/filter-bar";
import {
  KartuSkeleton,
  KeadaanGagal,
  KeadaanKosong,
} from "@/components/dashboard/states";
import { ClosingDetailDialog } from "@/components/closing/closing-detail-dialog";
import {
  LIMIT_LAPORAN,
  useClosingComparison,
  useClosingReports,
} from "@/hooks/use-closing";
import { formatSelisih, totalBaris } from "@/lib/closing";
import { bacaFilter, filterKeQuery, type Filter } from "@/lib/filter";
import {
  formatAngka,
  formatTanggal,
  formatTanggalWaktuUtc,
} from "@/lib/format";
import type { Role } from "@/lib/auth/current-user";
import type { ClosingComparisonRow } from "@/types/domain";
import { cn } from "@/lib/utils";
import { CaraKerja, PageHeader } from "@/components/layout/page-header";
import { Paginasi } from "@/components/layout/paginasi";

const TAB_LAPORAN = "laporan";
const TAB_PERBANDINGAN = "perbandingan";

/**
 * Closing report dari sistem lain (RabbitMQ) dan perbandingannya dengan
 * penjualan POS. Filter tanggal = tanggal produksi untuk perbandingan, dan
 * tanggal closing untuk daftar laporan.
 */
export function ClosingView({ role }: { role: Role }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filter = useMemo(
    () => bacaFilter(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const tab =
    searchParams.get("tab") === TAB_LAPORAN ? TAB_LAPORAN : TAB_PERBANDINGAN;

  function gantiTab(berikutnya: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (berikutnya === TAB_LAPORAN) params.set("tab", TAB_LAPORAN);
    else params.delete("tab");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Closing Report"
        description="Laporan closing harian per outlet (terjual, waste, adjustment, kompensasi) yang dikirim sistem closing, dibandingkan dengan penjualan POS."
      />

      <FilterBar role={role} tanpaBrand />

      <Tabs value={tab} onValueChange={gantiTab}>
        <TabsList>
          <TabsTrigger value={TAB_PERBANDINGAN}>Perbandingan POS</TabsTrigger>
          <TabsTrigger value={TAB_LAPORAN}>Daftar laporan</TabsTrigger>
        </TabsList>
        <TabsContent value={TAB_PERBANDINGAN} className="pt-4">
          <Perbandingan filter={filter} role={role} />
        </TabsContent>
        <TabsContent value={TAB_LAPORAN} className="pt-4">
          {/* Ganti filter = mulai dari halaman pertama lagi. */}
          <DaftarLaporan
            key={JSON.stringify(filterKeQuery(filter))}
            filter={filter}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Perbandingan({ filter, role }: { filter: Filter; role: Role }) {
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const query = useClosingComparison(filter, includeDeleted);

  const baris = query.data ?? [];
  const belumDipetakan = baris.filter(
    (b) => b.menu_id && !b.products?.length,
  ).length;
  // Produk POS yang terjual tetapi qty-nya tidak ada di baris menu mana pun.
  const hanyaPos = baris.filter((b) => !b.menu_id).length;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CaraKerja label="Cara membaca tabel">
            <p>
              Satu baris per menu Colorplate per outlet dan tanggal produksi.
              POS = jumlah qty order detail pada outlet dan tanggal yang sama
              dari produk POS yang dipetakan ke menu itu.
            </p>
            <p>
              Transaksi POS lain pada outlet dan tanggal yang sama — termasuk
              produk yang bukan Colorplate — ikut tampil untuk konsolidasi.
            </p>
            <p>
              Total Sold = Colorplate terjual + qty POS; angka yang kosong
              dihitung 0.
            </p>
          </CaraKerja>

          <div className="flex items-center gap-2">
            <Switch
              id="closing-void"
              checked={includeDeleted}
              onCheckedChange={setIncludeDeleted}
            />
            <Label htmlFor="closing-void">Ikutkan transaksi void</Label>
          </div>
        </div>

        {belumDipetakan > 0 && role === "admin" ? (
          <p className="text-sm">
            {formatAngka(belumDipetakan)} menu belum punya angka POS karena
            belum dipetakan ke ProductID POS.{" "}
            <Link
              href="/closing-menu"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Petakan menu
            </Link>
          </p>
        ) : null}

        {hanyaPos > 0 ? (
          <p className="text-sm">
            {formatAngka(hanyaPos)} produk POS terjual tetapi tidak ada menunya
            di Colorplate.
          </p>
        ) : null}

        {query.isPending ? (
          <KartuSkeleton baris={8} />
        ) : query.isError ? (
          <KeadaanGagal error={query.error} onCobaLagi={query.refetch} />
        ) : baris.length === 0 ? (
          <KeadaanKosong
            judul="Belum ada closing report"
            keterangan="Tidak ada closing pada rentang tanggal produksi ini."
          />
        ) : (
          <div
            className={cn(
              "overflow-x-auto",
              query.isFetching && "opacity-60 transition-opacity",
            )}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2}>Tgl. produksi</TableHead>
                  <TableHead rowSpan={2}>Outlet</TableHead>
                  <TableHead rowSpan={2}>Menu</TableHead>
                  <TableHead
                    colSpan={4}
                    scope="colgroup"
                    className="border-l text-center"
                  >
                    Colorplate
                  </TableHead>
                  <TableHead
                    colSpan={2}
                    scope="colgroup"
                    className="border-l text-center"
                  >
                    POS
                  </TableHead>
                  <TableHead
                    colSpan={4}
                    scope="colgroup"
                    className="border-l text-center"
                  >
                    Total
                  </TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className="border-l text-right">Terjual</TableHead>
                  <TableHead className="text-right">Waste</TableHead>
                  <TableHead className="text-right">Adjustment</TableHead>
                  <TableHead className="text-right">Kompensasi</TableHead>
                  <TableHead className="border-l">Produk</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="border-l text-right">
                    Total Sold
                  </TableHead>
                  <TableHead className="text-right">Total Waste</TableHead>
                  <TableHead className="text-right">Total Adjustment</TableHead>
                  <TableHead className="text-right">Total Kompensasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baris.map((b) => {
                  const total = totalBaris(b);
                  return (
                    <TableRow
                      key={`${b.outlet_code}-${b.production_date}-${b.menu_id ?? `pos-${b.products?.[0]?.product_id}`}`}
                    >
                      <TableCell className="whitespace-nowrap">
                        {formatTanggal(b.production_date)}
                      </TableCell>
                      <TableCell className="font-mono">
                        {b.outlet_code}
                      </TableCell>
                      <TableCell>
                        {b.menu_id ? (
                          <>
                            <div className="font-medium">{b.menu_name}</div>
                            {b.menu_code ? (
                              <div className="text-muted-foreground font-mono text-xs">
                                {b.menu_code}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-destructive text-sm">
                            Tidak ada di Colorplate
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="border-l text-right tabular-nums">
                        {formatAngka(b.sold)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAngka(b.waste)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatSelisih(b.adjustment)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAngka(b.compensation)}
                      </TableCell>
                      <TableCell className="border-l">
                        <ProdukPos products={b.products ?? []} />
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {b.pos_qty == null ? "—" : formatAngka(b.pos_qty)}
                      </TableCell>
                      <TableCell className="border-l text-right font-medium tabular-nums">
                        {formatAngka(total.sold)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAngka(total.waste)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatSelisih(total.adjustment)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAngka(total.compensation)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Produk POS yang dipetakan ke satu menu (qty-nya dijumlah di kolom POS), atau
 * satu produk POS untuk baris tanpa menu.
 */
function ProdukPos({
  products,
}: {
  products: NonNullable<ClosingComparisonRow["products"]>;
}) {
  if (products.length === 0) {
    return (
      <span className="text-sm text-amber-800 dark:text-amber-400">
        Belum dipetakan
      </span>
    );
  }
  return (
    <ul className="space-y-1">
      {products.map((p) => (
        <li key={p.product_id}>
          <div className="font-medium">{p.product_name ?? "—"}</div>
          <div className="text-muted-foreground font-mono text-xs">
            {p.product_id}
            {p.product_group ? ` · ${p.product_group}` : ""}
            {p.multiplier !== 1 ? ` · × ${p.multiplier}` : ""}
          </div>
          {p.is_mapped ? null : (
            <div className="text-xs text-amber-800 dark:text-amber-400">
              Belum dipetakan ke menu
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function DaftarLaporan({ filter }: { filter: Filter }) {
  const [offset, setOffset] = useState(0);
  const [dipilih, setDipilih] = useState<string | null>(null);
  const query = useClosingReports(filter, offset);

  const baris = query.data?.data ?? [];
  const pagination = query.data?.pagination;

  return (
    <Card>
      <CardContent>
        {query.isPending ? (
          <KartuSkeleton baris={6} />
        ) : query.isError ? (
          <KeadaanGagal error={query.error} onCobaLagi={query.refetch} />
        ) : baris.length === 0 ? (
          <KeadaanKosong
            judul="Belum ada closing report"
            keterangan="Tidak ada closing pada rentang tanggal ini."
          />
        ) : (
          <div
            className={
              query.isFetching ? "opacity-60 transition-opacity" : undefined
            }
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tgl. closing</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead className="text-right">Item</TableHead>
                    <TableHead className="text-right">Revisi</TableHead>
                    <TableHead>Dikirim</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {baris.map((r) => (
                    <TableRow key={r.closing_report_id}>
                      <TableCell className="whitespace-nowrap">
                        {formatTanggal(r.report_date)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.outlet_name}</div>
                        <div className="text-muted-foreground font-mono text-xs">
                          {r.outlet_code}
                        </div>
                      </TableCell>
                      <TableCell>{r.brand_name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAngka(r.item_count)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAngka(r.revision_count)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTanggalWaktuUtc(r.sent_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDipilih(r.closing_report_id)}
                        >
                          Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Paginasi
              offset={offset}
              limit={LIMIT_LAPORAN}
              pagination={pagination}
              satuan="laporan"
              onPindah={setOffset}
            />
          </div>
        )}
      </CardContent>

      <ClosingDetailDialog
        closingReportId={dipilih}
        onClose={() => setDipilih(null)}
      />
    </Card>
  );
}
