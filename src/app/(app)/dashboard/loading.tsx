import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  KerangkaJudul,
  KerangkaMemuat,
  KerangkaTabel,
} from "@/components/layout/memuat";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Kerangka dashboard: urutan & ukurannya mengikuti `DashboardView`
 * (judul → filter → 4 kartu ringkasan → grafik harian → dua kartu →
 * tabel), supaya isi asli muncul di tempat yang sama tanpa lompatan.
 *
 * Grid ringkasan dan tinggi grafik (h-64) sengaja disalin dari
 * `SummaryCards` dan `DailyChart`; test memeriksa keduanya.
 */
export default function MemuatDashboard() {
  return (
    <KerangkaMemuat>
      <KerangkaJudul />

      {/* FilterBar: dua tanggal + pemilih brand/outlet. */}
      <div className="flex flex-wrap items-end gap-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-48" />
      </div>

      <div
        data-kerangka="ringkasan"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card data-kerangka="grafik">
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <KerangkaTabel baris={5} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card data-kerangka="tabel">
        <CardHeader>
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent>
          <KerangkaTabel baris={4} />
        </CardContent>
      </Card>
    </KerangkaMemuat>
  );
}
