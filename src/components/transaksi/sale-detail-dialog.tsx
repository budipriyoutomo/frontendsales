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
  TableFooter,
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
import type { SalePayment } from "@/types/domain";

/** Detail transaksi beserta item dan pembayarannya (TODO 5.3). */
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

            <Pembayaran
              payments={query.data.payments}
              dibayar={query.data.receipt_pay_price}
            />
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

/** Selisih di bawah ini dianggap sama, mengikuti toleransi agen POS. */
const TOLERANSI = 0.5;

function Pembayaran({
  payments,
  dibayar,
}: {
  payments: SalePayment[] | null | undefined;
  dibayar: number;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">Pembayaran</h3>
      {payments == null ? (
        <p className="text-muted-foreground text-sm">
          Data pembayaran belum dikirim POS untuk transaksi ini.
        </p>
      ) : payments.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          POS mencatat transaksi ini tanpa pembayaran.
        </p>
      ) : (
        <TabelPembayaran payments={payments} dibayar={dibayar} />
      )}
    </section>
  );
}

function TabelPembayaran({
  payments,
  dibayar,
}: {
  payments: SalePayment[];
  dibayar: number;
}) {
  const total = payments.reduce((n, p) => n + p.amount, 0);
  const selisih = Math.abs(total - dibayar) > TOLERANSI;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jenis bayar</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead className="text-right">Kembalian</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={`${p.computer_id}-${p.pay_detail_id}`}>
                <TableCell className="font-medium">
                  {p.pay_type_display_name ??
                    p.pay_type_name ??
                    p.pay_type_code ??
                    `Jenis #${p.pay_type_id}`}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRupiah(p.amount)}
                </TableCell>
                <TableCell className="text-muted-foreground text-right tabular-nums">
                  {p.cash_change ? formatRupiah(p.cash_change) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatRupiah(total)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      {selisih ? (
        <p className="text-destructive text-sm" role="note">
          Total pembayaran tidak sama dengan nilai dibayar (
          {formatRupiah(dibayar)}).
        </p>
      ) : null}
    </div>
  );
}
