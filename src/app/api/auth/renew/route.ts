import { NextResponse, type NextRequest } from "next/server";
import { getApiBaseUrl } from "@/lib/api/bff";
import { clearSession, readSession, writeSession } from "@/lib/auth/session";

/**
 * Memperbarui access token lalu mengembalikan user ke halaman yang dia tuju
 * (TODO 2.4).
 *
 * Ada sebagai Route Handler tersendiri karena Server Component **tidak boleh**
 * memasang cookie — HTTP tidak mengizinkan Set-Cookie setelah body mengalir.
 * Jadi saat halaman server menemukan access token sudah mati, dia melempar ke
 * sini: di sini cookie boleh ditulis, lalu user dikembalikan.
 */

function tujuanAman(next: string | null): string {
  if (!next) return "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  // Jangan pernah memantul balik ke diri sendiri.
  if (next.startsWith("/api/auth/renew")) return "/dashboard";
  return next;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const next = tujuanAman(request.nextUrl.searchParams.get("next"));
  const session = await readSession();

  const gagal = async () => {
    await clearSession();
    const login = new URL("/login", request.url);
    login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  };

  if (!session?.refreshToken) return gagal();

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
      cache: "no-store",
    });
  } catch {
    return gagal();
  }

  if (!response.ok) return gagal();

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) return gagal();

  await writeSession({
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  });

  return NextResponse.redirect(new URL(next, request.url));
}
