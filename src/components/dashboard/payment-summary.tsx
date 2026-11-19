"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IsiKartu } from "@/components/dashboard/states";
import { usePaymentSummary } from "@/hooks/use-sales";
import { formatAngka, formatRupiah } from "@/lib/format";
import type { Filter } from "@/lib/filter";
import type { PaymentSummary as Ringkasan } from "@/types/domain";

/**
 * Total pembayaran per jenis bayar, dari data `payments` yang dikirim agen POS.
 *
 * Jenis bayar tidak digabung antar outlet: PayTypeID dan namanya milik POS
 * masing-masing outlet, jadi "Cash" di dua outlet tetap dua baris.
 */
export function PaymentSummary({ filter }: { filter: Filter }) {
  const query = usePaymentSummary(filter);

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Pembayaran per jenis</CardTitle>
        <CardDescription>
          Nominal bersih tanpa kembalian, dari data pembayaran POS.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <IsiKartu<Ringkasan>
          query={query}
          barisSkeleton={4}
          kosong={{
            judul: "Belum ada pembayaran",
            keterangan:
              "Tidak ada data pembayaran dari POS pada rentang tanggal ini.",
            bila: (d) =>
              d.rows.length === 0 && d.transactions_without_payments === 0,
          }}
        >
          {(data) => <TabelPembayaran data={data} />}
        </IsiKartu>
      </CardContent>
    </Card>
  );
}

function TabelPembayaran({ data }: { data: Ringkasan }) {
  // Kolom outlet hanya berguna kalau isinya lebih dari satu outlet.
  const banyakOutlet = new Set(data.rows.map((r) => r.outlet_code)).size > 1;

  return (
    <div className="space-y-3">
      {data.transactions_without_payments > 0 ? (
        <p className="text-muted-foreground text-sm" role="note">
          {formatAngka(data.transactions_without_payments)} transaksi belum
          punya data pembayaran dari POS dan tidak ikut dijumlah.
        </p>
      ) : null}

      {data.rows.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {banyakOutlet ? <TableHead>Outlet</TableHead> : null}
                <TableHead>Jenis bayar</TableHead>
                <TableHead className="text-right">Transaksi</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={`${r.outlet_code}-${r.pay_type_id}`}>
                  {banyakOutlet ? (
                    <TableCell className="text-muted-foreground">
                      {r.outlet_code ?? "—"}
                    </TableCell>
                  ) : null}
                  <TableCell className="font-medium">
                    {r.pay_type_name ?? `Jenis #${r.pay_type_id}`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAngka(r.total_transactions)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRupiah(r.total_amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={banyakOutlet ? 3 : 2}>Total</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRupiah(data.total_amount)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
