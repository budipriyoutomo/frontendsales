"use client";

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
import { Badge } from "@/components/ui/badge";
import {
  KartuSkeleton,
  KeadaanGagal,
  KeadaanKosong,
} from "@/components/dashboard/states";
import { useSaleDetail } from "@/hooks/use-transaksi";
import { formatAngka, formatRupiah, formatTanggalWaktu } from "@/lib/format";
import { transaksiVoid } from "@/lib/transaksi";

/** Detail transaksi beserta itemnya (TODO 5.3). */
export function SaleDetailDialog({
  transactionId,
  onClose,
}: {
  transactionId: number | null;
  onClose: () => void;
}) {
  const query = useSaleDetail(transactionId);

  return (
    <Dialog
      open={transactionId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detail transaksi</DialogTitle>
          <DialogDescription>
            {transactionId === null ? null : `ID ${transactionId}`}
          </DialogDescription>
        </DialogHeader>

        {query.isPending ? <KartuSkeleton baris={6} /> : null}

        {query.isError ? (
          <KeadaanGagal error={query.error} onCobaLagi={query.refetch} />
        ) : null}

        {query.data ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Baris label="Outlet" nilai={query.data.outlet_code ?? "—"} />
              <Baris label="No. struk" nilai={query.data.reference_no ?? "—"} />
              <Baris
                label="Waktu bayar"
                nilai={formatTanggalWaktu(query.data.paid_time)}
              />
              <Baris
                label="Dibayar"
                nilai={formatRupiah(query.data.receipt_pay_price)}
              />
              <Baris
                label="Diskon"
                nilai={formatRupiah(query.data.receipt_discount)}
              />
              <div>
                <dt className="text-muted-foreground text-xs">Status</dt>
                <dd className="mt-0.5">
                  {transaksiVoid(query.data) ? (
                    <Badge variant="destructive">Void</Badge>
                  ) : (
                    <Badge variant="secondary">Normal</Badge>
                  )}
                </dd>
              </div>
            </dl>

            {query.data.items.length === 0 ? (
              <KeadaanKosong
                judul="Tidak ada item"
                keterangan="Transaksi ini tidak memuat rincian item."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produk</TableHead>
                      <TableHead>Grup</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Harga</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {query.data.items.map((item) => (
                      <TableRow key={item.order_detail_id}>
                        <TableCell className="font-medium">
                          {item.product_name ?? `Produk #${item.product_id}`}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.product_group ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAngka(item.qty)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatRupiah(item.price)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 font-medium">{nilai}</dd>
    </div>
  );
}
