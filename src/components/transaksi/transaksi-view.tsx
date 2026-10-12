"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilterBar } from "@/components/dashboard/filter-bar";
import {
  KartuSkeleton,
  KeadaanGagal,
  KeadaanKosong,
} from "@/components/dashboard/states";
import { SaleDetailDialog } from "@/components/transaksi/sale-detail-dialog";
import { LIMIT_DEFAULT, useSalesList } from "@/hooks/use-transaksi";
import { api } from "@/lib/api/browser";
import { bacaFilter, filterKeQuery, filterKeSearchParams } from "@/lib/filter";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { transaksiVoid } from "@/lib/transaksi";
import type { Role } from "@/lib/auth/current-user";
import { unduhResponse } from "@/lib/download";
import { ApiError } from "@/lib/api/client";
import { Paginasi } from "@/components/layout/paginasi";

export function TransaksiView({ role }: { role: Role }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filter = useMemo(
    () => bacaFilter(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  // Nomor halaman ikut di URL, sama seperti filter — supaya tautan ke
  // halaman 3 benar-benar membuka halaman 3.
  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0) || 0);

  const [dipilih, setDipilih] = useState<number | null>(null);
  const [mengekspor, setMengekspor] = useState(false);

  const query = useSalesList(filter, offset);
  const pagination = query.data?.pagination;

  function pindahKe(offsetBaru: number) {
    const params = filterKeSearchParams(filter);
    if (offsetBaru > 0) params.set("offset", String(offsetBaru));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  async function ekspor() {
    setMengekspor(true);
    try {
      const response = await api.requestRaw("/api/sales/export", {
        query: filterKeQuery(filter),
      });

      if (!response.ok) {
        throw new ApiError({
          status: response.status,
          message: "Ekspor gagal. Coba lagi.",
        });
      }

      await unduhResponse(
        response,
        `transaksi_${filter.start_date}_${filter.end_date}.csv`,
      );
      toast.success("Berkas CSV sedang diunduh.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Ekspor gagal. Coba lagi.",
      );
    } finally {
      setMengekspor(false);
    }
  }

  const baris = query.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transaksi"
        description="Daftar struk pada rentang tanggal yang dipilih."
        actions={
          <Button variant="outline" onClick={ekspor} disabled={mengekspor}>
            <Download aria-hidden className="size-4" />
            {mengekspor ? "Menyiapkan…" : "Ekspor CSV"}
          </Button>
        }
      />

      <FilterBar role={role} />

      <Card>
        <CardContent>
          {query.isPending ? (
            <KartuSkeleton baris={8} />
          ) : query.isError ? (
            <KeadaanGagal error={query.error} onCobaLagi={query.refetch} />
          ) : baris.length === 0 ? (
            <KeadaanKosong
              judul="Belum ada transaksi"
              keterangan="Tidak ada struk pada rentang tanggal ini. Coba perlebar rentangnya."
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
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Outlet</TableHead>
                      <TableHead>No. struk</TableHead>
                      <TableHead className="text-right">Diskon</TableHead>
                      <TableHead className="text-right">Dibayar</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {baris.map((s) => {
                      const void_ = transaksiVoid(s);
                      return (
                        <TableRow
                          key={s.transaction_id}
                          className={
                            void_ ? "text-muted-foreground" : undefined
                          }
                        >
                          <TableCell>{formatTanggal(s.sale_date)}</TableCell>
                          <TableCell>{s.outlet_code ?? "—"}</TableCell>
                          <TableCell className="flex items-center gap-2">
                            <span
                              className={void_ ? "line-through" : undefined}
                            >
                              {s.reference_no ?? `#${s.transaction_id}`}
                            </span>
                            {/* Penanda punya ikon + teks, bukan warna saja. */}
                            {void_ ? (
                              <Badge variant="destructive">Void</Badge>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatRupiah(s.receipt_discount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatRupiah(s.receipt_pay_price)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDipilih(s.transaction_id)}
                            >
                              Detail
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <Paginasi
                offset={offset}
                limit={LIMIT_DEFAULT}
                pagination={pagination}
                satuan="transaksi"
                onPindah={pindahKe}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <SaleDetailDialog
        transactionId={dipilih}
        onClose={() => setDipilih(null)}
      />
    </div>
  );
}
