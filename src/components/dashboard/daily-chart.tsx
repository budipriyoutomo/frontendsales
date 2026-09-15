"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { IsiKartu } from "@/components/dashboard/states";
import { useDailySales } from "@/hooks/use-sales";
import { formatRupiah, formatTanggal } from "@/lib/format";
import type { Filter } from "@/lib/filter";
import type { DailyRow } from "@/types/domain";

/**
 * Grafik omzet harian (TODO 4.3).
 *
 * Satu deret, jadi satu warna — biru sekuensial, bukan palet kategorikal.
 * Tidak ada legend: judul kartu sudah menyebut deretnya.
 */
const config = {
  total_amount: {
    label: "Omzet",
    // Dua langkah biru yang sudah divalidasi terhadap permukaan kartu terang
    // (#ffffff) dan gelap (#171717) — keduanya lolos kontras >= 3:1.
    theme: { light: "#2a78d6", dark: "#3987e5" },
  },
} satisfies ChartConfig;

/** Sumbu-x hanya perlu "12 Sep", tahunnya sudah jelas dari filter. */
function labelSumbu(nilai: string | null | undefined): string {
  const teks = formatTanggal(nilai);
  return teks === "—" ? teks : teks.replace(/\s\d{4}$/, "");
}

/** Rp 4.418.375 terlalu panjang untuk tick — dipendekkan jadi "4,4 jt". */
function labelNilai(nilai: number): string {
  if (nilai >= 1_000_000) {
    return `${(nilai / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  }
  if (nilai >= 1_000) {
    return `${(nilai / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
  }
  return nilai.toLocaleString("id-ID");
}

export function DailyChart({ filter }: { filter: Filter }) {
  const query = useDailySales(filter);

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Omzet harian</CardTitle>
      </CardHeader>
      <CardContent>
        <IsiKartu<DailyRow[]>
          query={query}
          barisSkeleton={6}
          kosong={{
            judul: "Belum ada penjualan",
            keterangan:
              "Tidak ada transaksi pada rentang tanggal ini. Coba perlebar rentangnya.",
          }}
        >
          {(data) => (
            <ChartContainer config={config} className="h-64 w-full">
              <AreaChart
                data={data}
                margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
              >
                <defs>
                  <linearGradient id="gradienOmzet" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--color-total_amount)"
                      stopOpacity={0.22}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-total_amount)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>

                {/* Grid hairline solid — garis putus-putus terbaca sebagai
                    ambang batas, padahal ini cuma grid. */}
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeWidth={1}
                />

                <XAxis
                  dataKey="sale_date"
                  tickFormatter={labelSumbu}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  className="text-xs"
                />
                <YAxis
                  tickFormatter={labelNilai}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  className="text-xs tabular-nums"
                />

                <ChartTooltip
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, muatan) =>
                        formatTanggal(
                          (muatan?.[0]?.payload as DailyRow | undefined)
                            ?.sale_date,
                        )
                      }
                      formatter={(nilai) => formatRupiah(Number(nilai))}
                    />
                  }
                />

                <Area
                  type="monotone"
                  dataKey="total_amount"
                  stroke="var(--color-total_amount)"
                  strokeWidth={2}
                  fill="url(#gradienOmzet)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </IsiKartu>
      </CardContent>
    </Card>
  );
}
