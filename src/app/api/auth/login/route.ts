import { NextResponse, type NextRequest } from "next/server";
import { getApiBaseUrl } from "@/lib/api/bff";
import { writeSession } from "@/lib/auth/session";

/**
 * Login lewat BFF (keputusan 0.2).
 *
 * Token backend berhenti di sini: yang kembali ke browser hanya objek user.
 * Access dan refresh token dipasang sebagai cookie httpOnly, jadi tidak ada
 * JavaScript halaman yang bisa membacanya.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = (await request.json()) as unknown;

  const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    const headers = new Headers({ "Content-Type": "application/json" });

    // 429 tidak berguna tanpa Retry-After — halaman login menghitung mundur
    // dari angka ini, bukan menebak (TODO 2.6).
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) headers.set("Retry-After", retryAfter);

    return new NextResponse(detail || '{"detail":"Login gagal."}', {
      status: response.status,
      headers,
    });
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: unknown;
  };

  await writeSession({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  });

  return NextResponse.json({ user: data.user });
}
