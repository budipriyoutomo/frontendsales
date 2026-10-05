"use client";

import { Badge } from "@/components/ui/badge";
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
import { useClosingReport } from "@/hooks/use-closing";
import { formatSelisih } from "@/lib/closing";
import {
  formatAngka,
  formatTanggal,
  formatTanggalWaktuUtc,
} from "@/lib/format";

/** Item revisi aktif + riwayat kiriman satu closing report. */
export function ClosingDetailDialog({
  closingReportId,
  onClose,
}: {
  closingReportId: string | null;
  onClose: () => void;
}) {
  const query = useClosingReport(closingReportId);
  const data = query.data;

  return (
    <Dialog
      open={closingReportId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detail closing report</DialogTitle>
          <DialogDescription>
            {data
              ? `${data.outlet_name} (${data.outlet_code}) · ${formatTanggal(data.report_date)}`
              : null}
          </DialogDescription>
        </DialogHeader>

        {query.isPending ? <KartuSkeleton baris={6} /> : null}

        {query.isError ? (
          <KeadaanGagal error={query.error} onCobaLagi={query.refetch} />
        ) : null}

        {data ? (
          <div className="max-h-[70vh] space-y-6 overflow-y-auto">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Item (revisi aktif)</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Menu</TableHead>
                      <TableHead>Tgl. produksi</TableHead>
                      <TableHead className="text-right">Terjual</TableHead>
                      <TableHead className="text-right">Waste</TableHead>
                      <TableHead className="text-right">Adj.</TableHead>
                      <TableHead className="text-right">Komp.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((i) => (
                      <TableRow key={`${i.menu_id}-${i.production_date}`}>
                        <TableCell>
                          <div className="font-medium">{i.menu_name}</div>
                          <div className="text-muted-foreground font-mono text-xs">
                            {i.menu_code}
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatTanggal(i.production_date)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAngka(i.sold)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAngka(i.waste)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatSelisih(i.adjustment)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAngka(i.compensation)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Riwayat kiriman</h3>
              <p className="text-muted-foreground text-sm">
                Kiriman ulang menjadi revisi baru. Revisi lama tetap tersimpan;
                yang berlaku hanya revisi aktif.
              </p>
              <ul className="divide-y rounded-md border text-sm">
                {data.revisions.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <div>
                      <div className="font-mono text-xs break-all">
                        {r.message_id}
                      </div>
                      <div className="text-muted-foreground">
                        Dikirim {formatTanggalWaktuUtc(r.sent_at)} ·{" "}
                        {formatAngka(r.item_count)} item
                      </div>
                    </div>
                    {r.is_current ? (
                      <Badge>Aktif</Badge>
                    ) : (
                      <Badge variant="outline">Lama</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
