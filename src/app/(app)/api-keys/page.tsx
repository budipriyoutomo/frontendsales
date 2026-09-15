import type { Metadata } from "next";
import { headers } from "next/headers";
import { ApiKeysView } from "@/components/admin/api-keys-view";
import { RequireRole } from "@/components/auth/require-role";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PATHNAME_HEADER } from "@/proxy";

export const metadata: Metadata = {
  title: "API Key — Maharasa Sync",
};

export default async function ApiKeysPage() {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "/api-keys";
  const user = await getCurrentUser(pathname);

  return (
    <RequireRole user={user} izinkan={["admin"]}>
      <ApiKeysView />
    </RequireRole>
  );
}
