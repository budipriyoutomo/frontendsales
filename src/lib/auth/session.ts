import "server-only";

import { cookies } from "next/headers";

import { ACCESS_COOKIE, REFRESH_COOKIE } from "./cookie-names";

/**
 * Sesi disimpan di cookie httpOnly (keputusan 0.2, opsi BFF).
 *
 * Alasannya bukan gaya: dashboard ini bisa memutar ulang API key **semua**
 * outlet, jadi token admin yang bocor lewat XSS sama dengan seluruh kunci POS
 * bocor. Token tidak pernah tersentuh JavaScript browser.
 */
export { ACCESS_COOKIE, REFRESH_COOKIE } from "./cookie-names";

/** Refresh token backend berumur 7 hari — cookie mengikuti umur itu. */
const REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export type Session = {
  accessToken: string;
  refreshToken: string;
};

function baseCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Di localhost (http) cookie `secure` tidak akan pernah terkirim.
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value ?? "";
  const refreshToken = jar.get(REFRESH_COOKIE)?.value ?? "";

  // Tanpa refresh token sesi tidak bisa dipulihkan, jadi dianggap tidak ada.
  if (!refreshToken) return null;

  return { accessToken, refreshToken };
}

/**
 * Hanya boleh dipanggil dari Route Handler atau Server Function — HTTP tidak
 * mengizinkan Set-Cookie setelah body mulai mengalir.
 */
export async function writeSession(tokens: {
  accessToken: string;
  refreshToken?: string;
  /** Umur access token dalam detik, dari `expires_in` backend. */
  expiresIn?: number;
}): Promise<void> {
  const jar = await cookies();

  jar.set(ACCESS_COOKIE, tokens.accessToken, {
    ...baseCookieOptions(),
    maxAge: tokens.expiresIn ?? 30 * 60,
  });

  if (tokens.refreshToken) {
    jar.set(REFRESH_COOKIE, tokens.refreshToken, {
      ...baseCookieOptions(),
      maxAge: REFRESH_MAX_AGE_SECONDS,
    });
  }
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}
