import { Card, CardContent } from "@/components/ui/card";
import {
  KerangkaJudul,
  KerangkaMemuat,
  KerangkaTabel,
} from "@/components/layout/memuat";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Kerangka umum saat pindah menu di dalam shell.
 *
 * Tanpa file ini layar diam sampai render server halaman tujuan selesai.
 * Bentuknya generik (judul + baris filter + tabel) karena kebanyakan halaman
 * admin memang begitu; halaman yang bentuknya jauh berbeda punya
 * `loading.tsx` sendiri (lihat `dashboard/loading.tsx`).
 */
export default function MemuatHalaman() {
  return (
    <KerangkaMemuat>
      <KerangkaJudul />

      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
      </div>

      <Card>
        <CardContent>
          <KerangkaTabel />
        </CardContent>
      </Card>
    </KerangkaMemuat>
  );
}
