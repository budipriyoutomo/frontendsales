import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/api/bff";
import { clearSession, readSession } from "@/lib/auth/session";

/**
 * Logout. Backend hanya mencatat penanda — yang benar-benar mengakhiri sesi
 * adalah terhapusnya cookie di sini.
 */
export async function POST(): Promise<NextResponse> {
  const session = await readSession();

  if (session?.accessToken) {
    // Best-effort: backend gagal dihubungi tidak boleh membuat user terjebak
    // dalam sesi yang tidak bisa ditutup.
    try {
      await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store",
      });
    } catch {
      // sengaja diabaikan
    }
  }

  await clearSession();

  return NextResponse.json({ success: true });
}
