import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { ProductGroupTabs } from "@/components/admin/product-group-tabs";
import { RequireRole } from "@/components/auth/require-role";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PATHNAME_HEADER } from "@/proxy";

export const metadata: Metadata = {
  title: "Product Group — Maharasa Sync",
};

export default async function ProductGroupPage() {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "/product-group";
  const user = await getCurrentUser(pathname);

  return (
    <RequireRole user={user} izinkan={["admin"]}>
      {/* `useSearchParams` (tab di URL) butuh batas Suspense. */}
      <Suspense fallback={null}>
        <ProductGroupTabs />
      </Suspense>
    </RequireRole>
  );
}
