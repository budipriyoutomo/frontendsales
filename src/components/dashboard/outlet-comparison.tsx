"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { IsiKartu } from "@/components/dashboard/states";
import { useSalesByOutlet } from "@/hooks/use-sales";
import { formatRupiah } from "@/lib/format";
import type { Filter } from "@/lib/filter";
import type { OutletSalesRow } from "@/types/domain";

/**
 * Perbandingan omzet antar outlet (TODO 4.4) — admin & manager saja.
 *
 * Batang horizontal karena kode outlet dibaca kiri-ke-kanan dan jumlahnya
 * bisa banyak. Satu deret = satu warna; mewarnai tiap batang menurut
 * besarnya hanya mengulang panjang batang dengan cara lain.
 */
const config = {
  total_amount: {
    label: "Omzet",
    theme: { light: "#2a78d6", dark: "#3987e5" },
  },
} satisfies ChartConfig;

function labelNilai(nilai: number): string {
  if (nilai >= 1_000_000) {
    return `${(nilai / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  }
  if (nilai >= 1_000) {
    return `${(nilai / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
  }
  return nilai.toLocaleString("id-ID");
}

export function OutletComparison({ filter }: { filter: Filter }) {
  const query = useSalesByOutlet(filter, true);

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Omzet per outlet</CardTitle>
      </CardHeader>
      <CardContent>
        <IsiKartu<OutletSalesRow[]>
          query={query}
          barisSkeleton={5}
          kosong={{
            judul: "Belum ada penjualan",
            keterangan:
              "Tidak ada outlet dengan transaksi pada rentang tanggal ini.",
          }}
        >
          {(data) => {
            const urut = [...data].sort(
              (a, b) => b.total_amount - a.total_amount,
            );

            return (
              <ChartContainer
                config={config}
                className="w-full"
                style={{ height: Math.max(160, urut.length * 38 + 32) }}
              >
                <BarChart
                  data={urut}
                  layout="vertical"
                  margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke="var(--border)"
                    strokeWidth={1}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={labelNilai}
                    tickLine={false}
                    axisLine={false}
                    className="text-xs tabular-nums"
                  />
                  <YAxis
                    type="category"
                    dataKey="outlet_code"
                    tickLine={false}
                    axisLine={false}
                    width={88}
                    className="text-xs"
                  />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", fillOpacity: 0.4 }}
                    content={
                      <ChartTooltipContent
                        formatter={(nilai) => formatRupiah(Number(nilai))}
                      />
                    }
                  />
                  <Bar
                    dataKey="total_amount"
                    fill="var(--color-total_amount)"
                    // Ujung data membulat 4px, sisi baseline tetap tegak.
                    radius={[0, 4, 4, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ChartContainer>
            );
          }}
        </IsiKartu>
      </CardContent>
    </Card>
  );
}
