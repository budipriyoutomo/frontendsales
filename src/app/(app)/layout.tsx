import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { navUntukRole } from "@/lib/auth/access";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  JALUR_GANTI_PASSWORD,
  perluGantiPassword,
} from "@/lib/auth/wajib-ganti-password";
import { PATHNAME_HEADER } from "@/proxy";

/**
 * Layout untuk semua halaman yang butuh sesi.
 *
 * `proxy.ts` sudah menahan yang belum masuk, tapi di sini backend benar-benar
 * ditanya siapa usernya — pemeriksaan di proxy sengaja optimistis dan tidak
 * boleh jadi satu-satunya penjaga.
 *
 * `/ganti-password` sengaja TIDAK berada di bawah layout ini; lihat
 * `src/app/(ganti-password)/layout.tsx`.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Hanya untuk `?next=` saat sesi perlu diperbarui. Tidak dipakai untuk
  // keputusan apa pun: header ini tidak sampai pada request RSC.
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "/dashboard";
  const user = await getCurrentUser(pathname);

  // Password yang masih ditentukan orang lain harus diganti lebih dulu —
  // sebelum halaman apa pun terbuka, bukan sekadar diingatkan (TODO 2.8).
  if (perluGantiPassword(user)) {
    redirect(JALUR_GANTI_PASSWORD);
  }

  return (
    <AppShell user={user} nav={navUntukRole(user.role)}>
      {children}
    </AppShell>
  );
}
