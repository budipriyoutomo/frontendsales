import "server-only";

import { redirect } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api/bff";
import { readSession } from "@/lib/auth/session";

export type Role = "admin" | "manager" | "outlet";

export type CurrentUser = {
  id: number;
  email: string;
  full_name: string | null;
  role: Role;
  outlet_code: string | null;
  is_active: boolean;
  /** Password masih ditentukan orang lain dan wajib diganti pemiliknya (2.8).
   *  Opsional: backend versi lama belum mengirimnya. */
  must_change_password?: boolean;
};

/**
 * User yang sedang masuk, dibaca di sisi server dari `/api/auth/me`.
 *
 * Dipakai shell dan penjaga role (Fase 3). Berbeda dari `proxy.ts` yang cuma
 * melihat ada-tidaknya cookie, di sini backend benar-benar ditanya — jadi
 * role yang berubah langsung berlaku, tanpa menunggu login ulang.
 */
export async function getCurrentUser(
  pathSekarang: string,
): Promise<CurrentUser> {
  const session = await readSession();

  if (!session) redirect(`/login?next=${encodeURIComponent(pathSekarang)}`);

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    });
  } catch {
    throw new Error("Tidak dapat menghubungi server.");
  }

  if (response.status === 401) {
    // Access token habis, tapi refresh token mungkin masih hidup. Cookie tidak
    // boleh ditulis dari sini, jadi urusannya diserahkan ke Route Handler.
    redirect(`/api/auth/renew?next=${encodeURIComponent(pathSekarang)}`);
  }

  if (!response.ok) {
    throw new Error(`Gagal membaca profil pengguna (HTTP ${response.status}).`);
  }

  return (await response.json()) as CurrentUser;
}
