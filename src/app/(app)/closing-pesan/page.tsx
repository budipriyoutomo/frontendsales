import type { Metadata } from "next";
import { headers } from "next/headers";
import { ClosingMessagesView } from "@/components/admin/closing-messages-view";
import { RequireRole } from "@/components/auth/require-role";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PATHNAME_HEADER } from "@/proxy";

export const metadata: Metadata = {
  title: "Pesan RabbitMQ — Maharasa Sync",
};

export default async function ClosingPesanPage() {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "/closing-pesan";
  const user = await getCurrentUser(pathname);

  return (
    <RequireRole user={user} izinkan={["admin"]}>
      <ClosingMessagesView />
    </RequireRole>
  );
}
