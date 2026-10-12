"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ClosingMessageDetailDialog } from "@/components/admin/closing-message-detail-dialog";
import { StatusPesanBadge } from "@/components/closing/closing-status-badge";
import {
  LIMIT_LAPORAN,
  useClosingMessages,
  type FilterPesan,
} from "@/hooks/use-closing";
import {
  STATUS_PESAN,
  URUTAN_STATUS_PESAN,
  type StatusPesan,
} from "@/lib/closing";
import {
  formatAngka,
  formatTanggal,
  formatTanggalWaktuUtc,
} from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Paginasi } from "@/components/layout/paginasi";

/** Jeda sebelum pencarian dikirim — satu request per ketikan terlalu boros. */
const JEDA_CARI_MS = 300;

/**
 * Log pesan `closingreport.submitted` dari RabbitMQ (backend migrasi 013).
 *
 * Satu baris per pesan yang diputuskan consumer — termasuk retry yang menjadi
 * duplikat dan pesan yang ditolak ke DLQ — supaya admin bisa memeriksa isi
 * pesan dan alasan penolakan tanpa membuka log server.
 */
export function ClosingMessagesView() {
  const [status, setStatus] = useState<StatusPesan | undefined>();
  const [cari, setCari] = useState("");
  const [cariTerkirim, setCariTerkirim] = useState("");
  const [mulai, setMulai] = useState("");
  const [sampai, setSampai] = useState("");
  const [offset, setOffset] = useState(0);
  const [dipilih, setDipilih] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setCariTerkirim(cari.trim());
      setOffset(0);
    }, JEDA_CARI_MS);
    return () => clearTimeout(t);
  }, [cari]);

  const filter: FilterPesan = {
    status,
    q: cariTerkirim,
    start_date: mulai,
    end_date: sampai,
  };
  const query = useClosingMessages(filter, offset);

  const baris = query.data?.data ?? [];
  const counts = query.data?.counts;
  const pagination = query.data?.pagination;
  const semua = counts
    ? URUTAN_STATUS_PESAN.reduce((n, s) => n + counts[s], 0)
    : undefined;

  function pilihStatus(berikutnya: StatusPesan | undefined) {
    setStatus(berikutnya);
    setOffset(0);
  }

  const pilihan: {
    value: StatusPesan | undefined;
    label: string;
    n?: number;
  }[] = [
    { value: undefined, label: "Semua", n: semua },
    ...URUTAN_STATUS_PESAN.map((s) => ({
      value: s,
      label: STATUS_PESAN[s].label,
      n: counts?.[s],
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pesan RabbitMQ"
        description="Semua pesan closing report yang diterima consumer, termasuk duplikat dan yang ditolak. Buka detail pesan untuk melihat alasan dan JSON aslinya."
        details={
          <>
            <p>
              Kiriman ulang dicatat sebagai duplikat. Pesan yang ditolak tidak
              tersimpan sebagai laporan dan masuk antrean DLQ.
            </p>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-4">
          <div
            role="group"
            aria-label="Saring status pesan"
            className="flex flex-wrap gap-2"
          >
            {pilihan.map((p) => (
              <Button
                key={p.value ?? "semua"}
                variant={status === p.value ? "default" : "outline"}
                size="sm"
                aria-pressed={status === p.value}
                onClick={() => pilihStatus(p.value)}
              >
                {p.n === undefined
                  ? p.label
                  : `${p.label} (${formatAngka(p.n)})`}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pesan-cari">Cari messageId atau outlet</Label>
              <Input
                id="pesan-cari"
                className="w-72 max-w-full"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pesan-mulai">Diterima dari</Label>
              <Input
                id="pesan-mulai"
                type="date"
                className="w-44"
                value={mulai}
                max={sampai || undefined}
                onChange={(e) => {
                  setMulai(e.target.value);
                  setOffset(0);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pesan-sampai">sampai</Label>
              <Input
                id="pesan-sampai"
                type="date"
                className="w-44"
                value={sampai}
                min={mulai || undefined}
                onChange={(e) => {
                  setSampai(e.target.value);
                  setOffset(0);
                }}
              />
            </div>
          </div>

          {query.isPending ? (
            <KartuSkeleton baris={6} />
          ) : query.isError ? (
            <KeadaanGagal error={query.error} onCobaLagi={query.refetch} />
          ) : baris.length === 0 ? (
            <KeadaanKosong
              judul="Belum ada pesan"
              keterangan={
                semua === 0 && !cariTerkirim && !mulai && !sampai
                  ? "Consumer closing report belum menerima pesan apa pun."
                  : "Tidak ada pesan yang cocok dengan filter ini."
              }
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
                      <TableHead>Diterima</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Outlet</TableHead>
                      <TableHead>Tgl. closing</TableHead>
                      <TableHead className="text-right">Item</TableHead>
                      <TableHead>messageId</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {baris.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatTanggalWaktuUtc(p.received_at)}
                        </TableCell>
                        <TableCell>
                          <StatusPesanBadge status={p.status} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {p.outlet_code ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatTanggal(p.report_date)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAngka(p.item_count)}
                        </TableCell>
                        <TableCell className="max-w-56 font-mono text-xs break-all">
                          {p.message_id ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.reason ? (
                            <div className="text-destructive">{p.reason}</div>
                          ) : null}
                          {p.warnings?.map((w) => (
                            <div
                              key={w}
                              className="text-amber-800 dark:text-amber-400"
                            >
                              {w}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDipilih(p.id)}
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
                satuan="pesan"
                onPindah={setOffset}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <ClosingMessageDetailDialog
        logId={dipilih}
        onClose={() => setDipilih(null)}
      />
    </div>
  );
}
