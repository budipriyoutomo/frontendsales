"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  StatusKirimBadge,
  StatusLogKirimBadge,
} from "@/components/closing/closing-status-badge";
import { ClosingExportDetailDialog } from "@/components/closing/closing-export-detail-dialog";
import { CaraKerja } from "@/components/layout/page-header";
import { Paginasi } from "@/components/layout/paginasi";
import { usePaginasiKlien } from "@/hooks/use-paginasi-klien";
import {
  LIMIT_LAPORAN,
  useClosingExportStatus,
  useClosingExports,
  useKirimClosing,
  useUlangiKirimClosing,
} from "@/hooks/use-closing";
import { ApiError } from "@/lib/api/client";
import type { Filter } from "@/lib/filter";
import {
  formatAngka,
  formatTanggal,
  formatTanggalWaktuUtc,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  ClosingExportDetail,
  ClosingExportStatus,
  ClosingExportSummary,
} from "@/types/domain";

/** Pesan error mutation; 422 blokir membawa `detail.message`. */
function pesanGagal(error: unknown) {
  if (error instanceof ApiError && error.status === 422) {
    const detail = error.detail as { message?: unknown } | undefined;
    if (detail && typeof detail.message === "string") return detail.message;
  }
  return error instanceof Error ? error.message : "Gagal mengirim rekap.";
}

/** Hasil kiriman: 201 dari backend belum tentu sampai di API tujuan. */
function umumkanHasil(log: ClosingExportDetail) {
  const pasangan = `${log.outlet_code} · ${formatTanggal(log.production_date)}`;
  if (log.status === "terkirim") {
    toast.success(`Rekap ${pasangan} terkirim.`);
  } else if (log.status === "duplikat") {
    toast.success(`Rekap ${pasangan} sudah ada di API tujuan.`);
  } else {
    toast.error(`Rekap ${pasangan} gagal dikirim.`, {
      description: [log.error, `${formatAngka(log.attempts)} percobaan`]
        .filter(Boolean)
        .join(" · "),
    });
  }
}

/** Kiriman terakhir bisa diulang dengan messageId yang sama. */
function bisaDiulang(log: ClosingExportSummary | null | undefined) {
  return log?.status === "gagal" || log?.status === "mengirim";
}

/**
 * Kirim rekap closing (Total Sold = Colorplate + POS) per outlet × tanggal
 * produksi ke API eksternal — admin saja (backend Fase 8). Kontrak:
 * sync-api docs/usulan-kontrak-kirim-closing.md.
 */
export function ClosingExportPanel({ filter }: { filter: Filter }) {
  const [konfirmasi, setKonfirmasi] = useState<ClosingExportStatus | null>(
    null,
  );
  const [detailId, setDetailId] = useState<number | null>(null);
  const status = useClosingExportStatus(filter);
  const kirim = useKirimClosing();
  const ulangi = useUlangiKirimClosing();

  function jalankanKirim(p: ClosingExportStatus) {
    kirim.mutate(
      { outlet_code: p.outlet_code, production_date: p.production_date },
      {
        onSuccess: (log) => {
          setKonfirmasi(null);
          umumkanHasil(log);
        },
        onError: (error) => toast.error(pesanGagal(error)),
      },
    );
  }

  function jalankanUlangi(id: number) {
    ulangi.mutate(id, {
      onSuccess: umumkanHasil,
      onError: (error) => toast.error(pesanGagal(error)),
    });
  }

  const baris = status.data ?? [];
  const paginasi = usePaginasiKlien(baris, {
    kunciReset: JSON.stringify(filter),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4">
          <CaraKerja label="Cara kerja kirim">
            <p>
              Satu kiriman berisi rekap satu outlet pada satu tanggal produksi:
              setiap menu Colorplate dan produk POS yang tidak ada di
              Colorplate, dengan Total Sold = Colorplate terjual + qty POS.
              Transaksi void tidak dihitung.
            </p>
            <p>
              Kiriman baru menggantikan isi kiriman sebelumnya di API tujuan.
              Kalau closing direvisi atau penjualan POS berubah setelah
              terkirim, statusnya menjadi <em>Perlu kirim ulang</em>.
            </p>
            <p>
              Belum bisa dikirim selama ada menu yang belum dipetakan, atau satu
              ProductID dipetakan ke lebih dari satu menu — qty POS-nya akan
              terhitung dobel.
            </p>
          </CaraKerja>

          {status.isPending ? (
            <KartuSkeleton baris={6} />
          ) : status.isError ? (
            <KeadaanGagal error={status.error} onCobaLagi={status.refetch} />
          ) : baris.length === 0 ? (
            <KeadaanKosong
              judul="Belum ada closing report"
              keterangan="Tidak ada closing pada rentang tanggal produksi ini."
            />
          ) : (
            <div>
              <div
                className={cn(
                  "overflow-x-auto",
                  status.isFetching && "opacity-60 transition-opacity",
                )}
              >
                <Table aria-label="Status kirim per outlet dan tanggal produksi">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tgl. produksi</TableHead>
                      <TableHead>Outlet</TableHead>
                      <TableHead className="text-right">Item</TableHead>
                      <TableHead className="text-right">Total Sold</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Kiriman terakhir</TableHead>
                      <TableHead className="w-40" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginasi.halaman.map((p) => (
                      <TableRow key={`${p.outlet_code}-${p.production_date}`}>
                        <TableCell className="whitespace-nowrap">
                          {formatTanggal(p.production_date)}
                        </TableCell>
                        <TableCell className="font-mono">
                          {p.outlet_code}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAngka(p.item_count)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatAngka(p.total_sold)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <StatusKirimBadge status={p.status} />
                            <AlasanBlokir pasangan={p} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <KirimanTerakhir log={p.last_attempt} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {bisaDiulang(p.last_attempt) ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={ulangi.isPending}
                                onClick={() =>
                                  jalankanUlangi(p.last_attempt!.id)
                                }
                                aria-label={`Ulangi kiriman ${p.outlet_code} ${formatTanggal(p.production_date)}`}
                              >
                                Ulangi
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              disabled={!p.can_send}
                              onClick={() => setKonfirmasi(p)}
                              aria-label={`Kirim ${p.outlet_code} ${formatTanggal(p.production_date)}`}
                            >
                              Kirim
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Paginasi
                offset={paginasi.offset}
                limit={paginasi.limit}
                pagination={paginasi.pagination}
                satuan="rekap"
                onPindah={paginasi.setOffset}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <RiwayatKiriman
        // Ganti filter = mulai dari halaman pertama lagi.
        key={JSON.stringify(filter)}
        filter={filter}
        onDetail={setDetailId}
      />

      <KonfirmasiKirimDialog
        pasangan={konfirmasi}
        sedangProses={kirim.isPending}
        onBatal={() => setKonfirmasi(null)}
        onKirim={jalankanKirim}
      />

      <ClosingExportDetailDialog
        logId={detailId}
        onClose={() => setDetailId(null)}
        sedangMengulang={ulangi.isPending}
        onUlangi={jalankanUlangi}
      />
    </div>
  );
}

function AlasanBlokir({ pasangan }: { pasangan: ClosingExportStatus }) {
  const { menu_belum_dipetakan: belum, produk_dobel: dobel } = pasangan;
  if (belum.length === 0 && dobel.length === 0) return null;

  return (
    <div className="space-y-1 text-xs text-amber-800 dark:text-amber-400">
      {belum.length > 0 ? (
        <p>
          {formatAngka(belum.length)} menu belum dipetakan:{" "}
          {belum.map((m) => m.menu_code ?? m.menu_name ?? m.menu_id).join(", ")}
        </p>
      ) : null}
      {dobel.map((d) => (
        <p key={d.product_id}>
          ProductID {d.product_id}
          {d.product_name ? ` (${d.product_name})` : ""} dipetakan ke{" "}
          {d.menus.length} menu: {d.menus.join(", ")}
        </p>
      ))}
      <Link
        href="/closing-menu"
        className="text-primary font-medium underline-offset-4 hover:underline"
      >
        Petakan menu
      </Link>
    </div>
  );
}

function KirimanTerakhir({
  log,
}: {
  log: ClosingExportSummary | null | undefined;
}) {
  if (!log) return <span className="text-muted-foreground text-sm">—</span>;
  return (
    <div className="space-y-1 text-sm">
      <div className="flex items-center gap-2">
        <StatusLogKirimBadge status={log.status} />
        <span className="text-muted-foreground whitespace-nowrap">
          {formatTanggalWaktuUtc(log.finished_at ?? log.started_at)}
        </span>
      </div>
      {log.status === "gagal" && log.error ? (
        <p className="text-destructive text-xs">
          {log.error} · {formatAngka(log.attempts)} percobaan
        </p>
      ) : null}
    </div>
  );
}

function KonfirmasiKirimDialog({
  pasangan,
  sedangProses,
  onBatal,
  onKirim,
}: {
  pasangan: ClosingExportStatus | null;
  sedangProses: boolean;
  onBatal: () => void;
  onKirim: (p: ClosingExportStatus) => void;
}) {
  return (
    <Dialog
      open={pasangan !== null}
      onOpenChange={(open) => {
        if (!open && !sedangProses) onBatal();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kirim rekap closing</DialogTitle>
          <DialogDescription>
            Isi kiriman ini menggantikan kiriman sebelumnya untuk outlet dan
            tanggal yang sama di API tujuan.
          </DialogDescription>
        </DialogHeader>

        {pasangan ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Outlet</dt>
              <dd className="font-mono">{pasangan.outlet_code}</dd>
              <dt className="text-muted-foreground">Tgl. produksi</dt>
              <dd>{formatTanggal(pasangan.production_date)}</dd>
              <dt className="text-muted-foreground">Item</dt>
              <dd className="tabular-nums">
                {formatAngka(pasangan.item_count)}
              </dd>
              <dt className="text-muted-foreground">Total Sold</dt>
              <dd className="font-medium tabular-nums">
                {formatAngka(pasangan.total_sold)}
              </dd>
            </dl>

            {pasangan.status === "perlu_kirim_ulang" ? (
              <p className="text-sm text-amber-800 dark:text-amber-400">
                Rekap berubah sejak terakhir terkirim
                {pasangan.last_sent
                  ? ` (${formatTanggalWaktuUtc(pasangan.last_sent.finished_at ?? pasangan.last_sent.started_at)})`
                  : ""}
                .
              </p>
            ) : pasangan.status === "terkirim" ? (
              <p className="text-muted-foreground text-sm">
                Rekap ini sudah terkirim dan isinya belum berubah.
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onBatal} disabled={sedangProses}>
            Batal
          </Button>
          <Button
            onClick={() => pasangan && onKirim(pasangan)}
            disabled={sedangProses}
          >
            {sedangProses ? "Mengirim…" : "Kirim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RiwayatKiriman({
  filter,
  onDetail,
}: {
  filter: Filter;
  onDetail: (id: number) => void;
}) {
  const [offset, setOffset] = useState(0);
  const query = useClosingExports(filter, offset);
  const baris = query.data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat kiriman</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <KartuSkeleton baris={4} />
        ) : query.isError ? (
          <KeadaanGagal error={query.error} onCobaLagi={query.refetch} />
        ) : baris.length === 0 ? (
          <KeadaanKosong
            judul="Belum ada kiriman"
            keterangan="Belum ada rekap yang dikirim pada rentang tanggal produksi ini."
          />
        ) : (
          <div
            className={
              query.isFetching ? "opacity-60 transition-opacity" : undefined
            }
          >
            <div className="overflow-x-auto">
              <Table aria-label="Riwayat kiriman">
                <TableHeader>
                  <TableRow>
                    <TableHead>Dikirim</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Tgl. produksi</TableHead>
                    <TableHead className="text-right">Ke-</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">HTTP</TableHead>
                    <TableHead className="text-right">Percobaan</TableHead>
                    <TableHead>Oleh</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {baris.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatTanggalWaktuUtc(log.created_at)}
                      </TableCell>
                      <TableCell className="font-mono">
                        {log.outlet_code}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTanggal(log.production_date)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAngka(log.sequence)}
                      </TableCell>
                      <TableCell>
                        <StatusLogKirimBadge status={log.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {log.http_status ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAngka(log.attempts)}
                      </TableCell>
                      <TableCell className="text-sm">{log.sent_by}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDetail(log.id)}
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
              pagination={query.data?.pagination}
              satuan="kiriman"
              onPindah={setOffset}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
