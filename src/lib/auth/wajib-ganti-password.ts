import type { CurrentUser } from "@/lib/auth/current-user";

/**
 * Paksa ganti password saat pertama masuk (TODO 2.8).
 *
 * Backend menyalakan `must_change_password` selama password sebuah akun masih
 * ditentukan orang lain — saat user dibuat, dan setiap kali admin mereset
 * paksa. Padam begitu pemiliknya mengganti sendiri lewat
 * `POST /api/auth/change-password`.
 */
export const JALUR_GANTI_PASSWORD = "/ganti-password";

export function perluGantiPassword(user: CurrentUser): boolean {
  // `=== true`, bukan truthy: backend versi lama tidak mengirim field ini
  // sama sekali, dan tidak adanya penanda berarti "tidak wajib" — jangan
  // mengunci orang keluar hanya karena kontraknya belum diperbarui.
  return user.must_change_password === true;
}
