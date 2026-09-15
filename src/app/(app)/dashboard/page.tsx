import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PATHNAME_HEADER } from "@/proxy";

export const metadata: Metadata = {
  title: "Dashboard — Maharasa Sync",
};

export default async function DashboardPage() {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "/dashboard";
  const user = await getCurrentUser(pathname);

  return (
    // `useSearchParams` butuh batas Suspense supaya halaman tidak dipaksa
    // dirender penuh di klien.
    <Suspense fallback={null}>
      <DashboardView role={user.role} />
    </Suspense>
  );
}
