import type { Metadata } from "next";
import { headers } from "next/headers";
import { TriangleAlert } from "lucide-react";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PATHNAME_HEADER } from "@/proxy";

export const metadata: Metadata = {
  title: "Ganti kata sandi — Maharasa Sync",
};

export default async function GantiPasswordPage() {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "/ganti-password";
  const user = await getCurrentUser(pathname);

  /**
   * Keadaan "dipaksa" dibaca dari akunnya sendiri, **bukan** dari query
   * `?wajib=1` (TODO 2.8).
   *
   * Dua alasan. Query bisa hilang saat navigasi klien, dan banner yang
   * seharusnya muncul jadi tidak muncul. Sebaliknya query bisa ditambahkan
   * siapa saja, dan banner jadi menakut-nakuti orang yang passwordnya
   * sebenarnya sudah aman. Sumber kebenarannya satu: `must_change_password`.
   */
  const dipaksa = user.must_change_password === true;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Ganti kata sandi
        </h1>
        <p className="text-muted-foreground text-sm">
          Anda perlu memasukkan kata sandi saat ini untuk mengubahnya.
        </p>
      </div>

      {dipaksa ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 flex max-w-xl gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <TriangleAlert
            aria-hidden
            className="text-destructive mt-0.5 size-4 shrink-0"
          />
          <p>
            Kata sandi akun ini <strong>masih ditentukan orang lain</strong> —
            dibuat oleh admin atau baru direset. Ganti dulu sebelum membuka
            halaman lain.
          </p>
        </div>
      ) : null}

      <ChangePasswordForm redirectSetelahSukses={dipaksa} />
    </div>
  );
}
