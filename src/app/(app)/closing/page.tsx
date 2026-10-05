import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { ClosingView } from "@/components/closing/closing-view";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PATHNAME_HEADER } from "@/proxy";

export const metadata: Metadata = {
  title: "Closing Report — Maharasa Sync",
};

export default async function ClosingPage() {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "/closing";
  const user = await getCurrentUser(pathname);

  return (
    <Suspense fallback={null}>
      <ClosingView role={user.role} />
    </Suspense>
  );
}
