import type { Metadata } from "next";
import { headers } from "next/headers";
import { UsersView } from "@/components/admin/users-view";
import { RequireRole } from "@/components/auth/require-role";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PATHNAME_HEADER } from "@/proxy";

export const metadata: Metadata = {
  title: "Pengguna — Maharasa Sync",
};

export default async function PenggunaPage() {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "/pengguna";
  const user = await getCurrentUser(pathname);

  return (
    <RequireRole user={user} izinkan={["admin"]}>
      <UsersView sayaId={user.id} />
    </RequireRole>
  );
}
