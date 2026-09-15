import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { TransaksiView } from "@/components/transaksi/transaksi-view";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PATHNAME_HEADER } from "@/proxy";

export const metadata: Metadata = {
  title: "Transaksi — Maharasa Sync",
};

export default async function TransaksiPage() {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "/transaksi";
  const user = await getCurrentUser(pathname);

  return (
    <Suspense fallback={null}>
      <TransaksiView role={user.role} />
    </Suspense>
  );
}
