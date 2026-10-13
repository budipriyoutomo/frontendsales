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
import { KartuSkeleton, KeadaanGagal } from "@/components/dashboard/states";
import { StatusLogKirimBadge } from "@/components/closing/closing-status-badge";
import { useClosingExport } from "@/hooks/use-closing";
import { formatJson } from "@/lib/closing";
import {
  formatAngka,
  formatTanggal,
  formatTanggalWaktuUtc,
} from "@/lib/format";

/** Satu kiriman ke API eksternal: identitas, hasil, payload persis, dan response API tujuan. */
export function ClosingExportDetailDialog({
  logId,
  onClose,
  sedangMengulang,
  onUlangi,
}: {
  logId: number | null;
  onClose: () => void;
  sedangMengulang: boolean;
  onUlangi: (id: number) => void;
}) {
  const query = useClosingExport(logId);
  const data = query.data;
  const [disalin, setDisalin] = useState(false);

  const payload = data ? formatJson(data.payload) : "";

  async function salin() {
    try {
      await navigator.clipboard.writeText(payload);
      setDisalin(true);
      setTimeout(() => setDisalin(false), 2000);
    } catch {
      // Clipboard bisa ditolak browser; isinya tetap bisa diblok manual.
    }
  }

  return (
    <Dialog
      open={logId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detail kiriman</DialogTitle>
          <DialogDescription>
            {data
              ? `${data.outlet_code} · ${formatTanggal(data.production_date)} · kiriman ke-${data.sequence}`
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
                <StatusLogKirimBadge status={data.status} />
              </dd>
              <dt className="text-muted-foreground">messageId</dt>
              <dd className="font-mono text-xs break-all">{data.message_id}</dd>
              <dt className="text-muted-foreground">HTTP</dt>
              <dd className="tabular-nums">{data.http_status ?? "—"}</dd>
              <dt className="text-muted-foreground">Percobaan</dt>
              <dd className="tabular-nums">{formatAngka(data.attempts)}</dd>
              {data.error ? (
                <>
                  <dt className="text-muted-foreground">Error</dt>
                  <dd className="text-destructive">{data.error}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Item</dt>
              <dd className="tabular-nums">{formatAngka(data.item_count)}</dd>
              <dt className="text-muted-foreground">Dikirim</dt>
              <dd>
                {formatTanggalWaktuUtc(data.created_at)} oleh {data.sent_by}
              </dd>
              <dt className="text-muted-foreground">Selesai</dt>
              <dd>{formatTanggalWaktuUtc(data.finished_at)}</dd>
            </dl>

            {data.status === "gagal" || data.status === "mengirim" ? (
              <Button
                variant="outline"
                size="sm"
                disabled={sedangMengulang}
                onClick={() => onUlangi(data.id)}
              >
                {sedangMengulang ? "Mengulang…" : "Ulangi kiriman"}
              </Button>
            ) : null}

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Response API tujuan</h3>
              {data.response_body ? (
                <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
                  {data.response_body}
                </pre>
              ) : (
                <p className="text-muted-foreground text-sm">Tidak ada.</p>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Payload yang dikirim</h3>
                <Button variant="outline" size="sm" onClick={salin}>
                  {disalin ? "Disalin" : "Salin"}
                </Button>
              </div>
              <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">
                {payload}
              </pre>
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
