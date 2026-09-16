"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { DailyChart } from "@/components/dashboard/daily-chart";
import { OutletComparison } from "@/components/dashboard/outlet-comparison";
import { TopProducts } from "@/components/dashboard/top-products";
import { GroupRecap } from "@/components/dashboard/group-recap";
import { bacaFilter } from "@/lib/filter";
import {
  PARAM_GROUP_REKAP,
  PARAM_GROUP_TERLARIS,
  bacaGroupTerpilih,
  gantiParam,
} from "@/lib/product-group";
import { bolehLihatPemilihOutlet } from "@/lib/auth/access";
import type { Role } from "@/lib/auth/current-user";

export function DashboardView({ role }: { role: Role }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams],
  );
  const filter = useMemo(() => bacaFilter(params), [params]);
  const groupRekap = useMemo(
    () => bacaGroupTerpilih(params, PARAM_GROUP_REKAP),
    [params],
  );
  const groupTerlaris = bacaGroupTerpilih(params, PARAM_GROUP_TERLARIS)[0];

  // Pilihan group hidup di URL bersama filter lain (10.12), jadi tautannya
  // bisa dibagikan dan tombol back mengembalikannya.
  function tulis(kunci: string, nilai: string[]) {
    router.replace(`${pathname}?${gantiParam(params, kunci, nilai)}`, {
      scroll: false,
    });
  }

  // `/api/sales/by-outlet` hanya untuk admin & manager; untuk role outlet
  // kartunya tidak dirender sama sekali, bukan dirender lalu gagal 403.
  const lintasOutlet = bolehLihatPemilihOutlet(role);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Ringkasan penjualan untuk rentang tanggal yang dipilih.
        </p>
      </div>

      {/* Satu baris filter untuk seluruh halaman, di atas semua kartu. */}
      <FilterBar role={role} />

      <SummaryCards filter={filter} />

      <DailyChart filter={filter} />

      <div className="grid gap-4 xl:grid-cols-2">
        {lintasOutlet ? <OutletComparison filter={filter} /> : null}
        <TopProducts
          filter={filter}
          group={groupTerlaris}
          onGroupChange={(g) => tulis(PARAM_GROUP_TERLARIS, g ? [g] : [])}
        />
      </div>

      <GroupRecap
        filter={filter}
        terpilih={groupRekap}
        onTerpilihChange={(groups) => tulis(PARAM_GROUP_REKAP, groups)}
      />
    </div>
  );
}
