import type { ReactNode } from "react";
import { AksesDitolak } from "@/components/auth/akses-ditolak";
import type { CurrentUser, Role } from "@/lib/auth/current-user";

/**
 * Penjaga halaman per role (TODO 3.3).
 *
 * Dipakai di Server Component halaman, jadi konten yang tidak boleh dilihat
 * tidak pernah ikut terkirim ke browser — bukan sekadar disembunyikan CSS.
 * Server tetap penjaga sebenarnya; ini supaya user dapat 403 yang jelas
 * (3.4), bukan tabel kosong atau layar error.
 */
export function RequireRole({
  user,
  izinkan,
  children,
}: {
  user: CurrentUser;
  izinkan: readonly Role[];
  children: ReactNode;
}) {
  if (!izinkan.includes(user.role)) {
    return <AksesDitolak role={user.role} />;
  }

  return <>{children}</>;
}
