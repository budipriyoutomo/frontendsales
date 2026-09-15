"use client";

import { AlertTriangle, CheckCircle2, CircleDashed, Clock } from "lucide-react";
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
import {
  KartuSkeleton,
  KeadaanGagal,
  KeadaanKosong,
} from "@/components/dashboard/states";
import { useSyncStatus } from "@/hooks/use-sales";
import { formatAngka, formatTanggal, formatTanggalWaktu } from "@/lib/format";
import {
  labelKesegaran,
  nilaiKesegaran,
  urutkanMendesak,
  varianBadge,
  type Kesegaran,
} from "@/lib/sync-status";

const IKON: Record<Kesegaran, typeof CheckCircle2> = {
  segar: CheckCircle2,
  waspada: Clock,
  basi: AlertTriangle,
  "belum-pernah": CircleDashed,
};

/**
 * Status sync per outlet (TODO Fase 7).
 *
 * Data di-refetch berkala (lihat `useSyncStatus`) — halaman yang isinya
 * "apakah POS masih hidup" jadi tidak ada gunanya kalau angkanya sendiri basi.
 */
export function SyncStatusView() {
  const query = useSyncStatus();
  const sekarang = new Date();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Status Sync</h1>
        <p className="text-muted-foreground text-sm">
          Kapan tiap outlet terakhir mengirim data. Outlet yang diam berarti
          omzetnya belum masuk laporan.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {query.isPending ? (
            <KartuSkeleton baris={6} />
          ) : query.isError ? (
            <KeadaanGagal error={query.error} onCobaLagi={query.refetch} />
          ) : (query.data ?? []).length === 0 ? (
            <KeadaanKosong
              judul="Belum ada outlet"
              keterangan="Belum ada outlet yang terdaftar mengirim data."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Terakhir sync</TableHead>
                    <TableHead>Penjualan terakhir</TableHead>
                    <TableHead className="text-right">Transaksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {urutkanMendesak(query.data ?? [], sekarang).map((row) => {
                    const k = nilaiKesegaran(row, sekarang);
                    const Ikon = IKON[k];

                    return (
                      <TableRow key={row.outlet_code}>
                        <TableCell className="font-medium">
                          {row.outlet_code ?? "—"}
                        </TableCell>
                        <TableCell>
                          {/* Ikon + teks, supaya status tidak bergantung
                              pada warna saja. */}
                          <Badge variant={varianBadge(k)} className="gap-1.5">
                            <Ikon aria-hidden className="size-3.5" />
                            {labelKesegaran(k)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {/* Outlet yang belum pernah sync tidak merender
                              tanggal kosong (7.5). */}
                          {k === "belum-pernah"
                            ? "Belum pernah"
                            : formatTanggalWaktu(row.last_synced_at)}
                        </TableCell>
                        <TableCell>
                          {formatTanggal(row.last_sale_date)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAngka(row.total_transactions)}
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
    </div>
  );
}
