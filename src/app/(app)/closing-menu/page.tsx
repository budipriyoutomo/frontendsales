import type { Metadata } from "next";
import { headers } from "next/headers";
import { ClosingMenusView } from "@/components/admin/closing-menus-view";
import { RequireRole } from "@/components/auth/require-role";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PATHNAME_HEADER } from "@/proxy";

export const metadata: Metadata = {
  title: "Mapping Menu Closing — Maharasa Sync",
};

export default async function ClosingMenuPage() {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "/closing-menu";
  const user = await getCurrentUser(pathname);

  return (
    <RequireRole user={user} izinkan={["admin"]}>
      <ClosingMenusView />
    </RequireRole>
  );
}
