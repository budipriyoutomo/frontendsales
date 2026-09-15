"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { DailyChart } from "@/components/dashboard/daily-chart";
import { OutletComparison } from "@/components/dashboard/outlet-comparison";
import { TopProducts } from "@/components/dashboard/top-products";
import { bacaFilter } from "@/lib/filter";
import { bolehLihatPemilihOutlet } from "@/lib/auth/access";
import type { Role } from "@/lib/auth/current-user";

export function DashboardView({ role }: { role: Role }) {
  const searchParams = useSearchParams();

  const filter = useMemo(
    () => bacaFilter(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

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
        <TopProducts filter={filter} />
      </div>
    </div>
  );
}
