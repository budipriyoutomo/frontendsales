import { AppShell } from "@/components/layout/app-shell";
import { navUntukRole } from "@/lib/auth/access";
import { getCurrentUser } from "@/lib/auth/current-user";
import { JALUR_GANTI_PASSWORD } from "@/lib/auth/wajib-ganti-password";

/**
 * Shell yang sama seperti `(app)`, tapi **tanpa** penjaga ganti-password.
 *
 * Inilah alasan halaman ini punya route group sendiri: kalau ia berada di
 * dalam `(app)`, penjaga di sana akan memantulkan user ke halaman ini — dan
 * karena halaman ini juga di dalamnya, pantulannya tidak pernah berhenti.
 *
 * Pemisahan struktural dipilih ketimbang mengecualikan berdasarkan pathname:
 * pathname hanya bisa didapat lewat header titipan `proxy.ts`, dan header itu
 * TIDAK sampai pada request RSC (navigasi sisi klien). Penjaga yang bergantung
 * padanya akan bekerja saat halaman dimuat langsung, lalu berputar tanpa henti
 * saat user berpindah dari dalam aplikasi.
 */
export default async function GantiPasswordLayout({
  children,
}: LayoutProps<"/">) {
  const user = await getCurrentUser(JALUR_GANTI_PASSWORD);

  return (
    <AppShell user={user} nav={navUntukRole(user.role)}>
      {children}
    </AppShell>
  );
}
