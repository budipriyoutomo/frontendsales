import type { Metadata } from "next";
import { headers } from "next/headers";
import { ProductsView } from "@/components/admin/products-view";
import { RequireRole } from "@/components/auth/require-role";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PATHNAME_HEADER } from "@/proxy";

export const metadata: Metadata = {
  title: "Produk — Maharasa Sync",
};

export default async function ProdukPage() {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "/produk";
  const user = await getCurrentUser(pathname);

  return (
    <RequireRole user={user} izinkan={["admin"]}>
      <ProductsView />
    </RequireRole>
  );
}
