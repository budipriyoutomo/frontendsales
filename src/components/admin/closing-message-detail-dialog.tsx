"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { KartuSkeleton, KeadaanGagal } from "@/components/dashboard/states";
import { StatusPesanBadge } from "@/components/closing/closing-status-badge";
import { useClosingMessage } from "@/hooks/use-closing";
import { formatJson, formatLokasiError } from "@/lib/closing";
import {
  formatAngka,
  formatTanggal,
  formatTanggalWaktuUtc,
} from "@/lib/format";

type ErrorValidasi = { loc?: unknown; msg?: unknown; type?: unknown };

/** Isi satu pesan RabbitMQ: identitas, alasan ditolak, peringatan, dan JSON asli. */
export function ClosingMessageDetailDialog({
  logId,
  onClose,
}: {
  logId: number | null;
  onClose: () => void;
}) {
  const query = useClosingMessage(logId);
  const data = query.data;
  const [disalin, setDisalin] = useState(false);

  const mentah =
    data === undefined
      ? ""
      : data.payload !== null && data.payload !== undefined
        ? formatJson(data.payload)
        : (data.body_text ?? "");

  async function salin() {
    try {
      await navigator.clipboard.writeText(mentah);
      setDisalin(true);
      setTimeout(() => setDisalin(false), 2000);
    } catch {
      // Clipboard bisa ditolak browser; isinya tetap bisa diblok manual.
    }
  }

  const errors = (data?.errors ?? []) as ErrorValidasi[];

  return (
    <Dialog
      open={logId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detail pesan</DialogTitle>
          <DialogDescription>
            {data
              ? `Diterima ${formatTanggalWaktuUtc(data.received_at)} · ${formatAngka(data.body_bytes)} byte`
              : null}
          </DialogDescription>
        </DialogHeader>

        {query.isPending ? <KartuSkeleton baris={6} /> : null}

        {query.isError ? (
          <KeadaanGagal error={query.error} onCobaLagi={query.refetch} />
        ) : null}

        {data ? (
          <div className="max-h-[70vh] space-y-6 overflow-y-auto">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <StatusPesanBadge status={data.status} />
              </dd>
              <dt className="text-muted-foreground">messageId</dt>
              <dd className="font-mono text-xs break-all">
                {data.message_id ?? "—"}
              </dd>
              <dt className="text-muted-foreground">closingReportId</dt>
              <dd className="font-mono text-xs break-all">
                {data.closing_report_id ?? "—"}
              </dd>
              <dt className="text-muted-foreground">Outlet</dt>
              <dd className="font-mono text-xs">{data.outlet_code ?? "—"}</dd>
              <dt className="text-muted-foreground">Tgl. closing</dt>
              <dd>{formatTanggal(data.report_date)}</dd>
              <dt className="text-muted-foreground">Item</dt>
              <dd className="tabular-nums">{formatAngka(data.item_count)}</dd>
            </dl>

            {data.reason ? (
              <section className="space-y-2">
                <h3 className="text-sm font-medium">Alasan ditolak</h3>
                <p className="text-destructive text-sm">{data.reason}</p>
                {errors.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Field</TableHead>
                          <TableHead>Masalah</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {errors.map((e, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">
                              {formatLokasiError(e.loc)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {String(e.msg ?? e.type ?? "")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}
              </section>
            ) : null}

            {data.warnings?.length ? (
              <section className="space-y-2">
                <h3 className="text-sm font-medium">Peringatan</h3>
                <ul className="list-inside list-disc text-sm text-amber-800 dark:text-amber-400">
                  {data.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">
                  {data.payload !== null && data.payload !== undefined
                    ? "JSON pesan"
                    : "Isi pesan (bukan JSON)"}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={salin}
                  disabled={!mentah}
                >
                  {disalin ? "Disalin" : "Salin"}
                </Button>
              </div>
              <pre className="bg-muted max-h-96 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap break-all">
                {mentah}
              </pre>
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
