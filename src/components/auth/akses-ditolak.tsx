import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/auth/current-user";

const NAMA_ROLE: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  outlet: "Outlet",
};

/**
 * Halaman 403 yang jelas (TODO 3.4).
 *
 * Menyebut role yang sedang dipakai, supaya user tahu ini soal hak akses —
 * bukan halaman rusak, dan bukan sesuatu yang bisa diperbaiki dengan reload.
 */
export function AksesDitolak({
  role,
  keterangan,
}: {
  role: Role;
  keterangan?: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <ShieldX aria-hidden className="text-muted-foreground size-10" />

      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Halaman ini tidak untuk Anda</h1>
        <p className="text-muted-foreground text-sm">
          {keterangan ??
            `Akun Anda masuk sebagai ${NAMA_ROLE[role]}, dan halaman ini hanya terbuka untuk Admin.`}
        </p>
        <p className="text-muted-foreground text-sm">
          Kalau Anda merasa seharusnya punya akses, hubungi admin untuk mengubah
          role akun Anda.
        </p>
      </div>

      <Button asChild variant="outline">
        <Link href="/dashboard">Kembali ke dashboard</Link>
      </Button>
    </div>
  );
}
