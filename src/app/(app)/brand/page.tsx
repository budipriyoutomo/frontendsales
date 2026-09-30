import type { Metadata } from "next";
import { headers } from "next/headers";
import { BrandsView } from "@/components/admin/brands-view";
import { RequireRole } from "@/components/auth/require-role";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PATHNAME_HEADER } from "@/proxy";

export const metadata: Metadata = {
  title: "Brand — Maharasa Sync",
};

export default async function BrandPage() {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "/brand";
  const user = await getCurrentUser(pathname);

  return (
    <RequireRole user={user} izinkan={["admin"]}>
      <BrandsView />
    </RequireRole>
  );
}
