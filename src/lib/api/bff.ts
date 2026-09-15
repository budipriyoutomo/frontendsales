import type { Session } from "@/lib/auth/session";

/**
 * Inti lapisan BFF (keputusan 0.2).
 *
 * Browser bicara ke Route Handler Next dengan cookie; fungsi ini yang bicara
 * ke FastAPI dengan Bearer. Di sinilah juga auto-refresh 401 hidup (2.5) —
 * sengaja di server, supaya tidak ada satu pun halaman klien yang perlu tahu
 * soal refresh token.
 */

export type ForwardInput = {
  /** Path di backend, sudah termasuk prefix `/api`. */
  path: string;
  /** Query string mentah, termasuk `?`. Boleh kosong. */
  search: string;
  method: string;
  /** Body mentah; harus string/null supaya bisa dikirim ulang saat retry. */
  body: string | null;
  session: Session | null;
};

export type ForwardResult =
  | {
      kind: "ok";
      response: Response;
      /** Terisi kalau di tengah jalan token diperbarui — caller wajib
       *  menuliskannya kembali ke cookie. */
      refreshedAccessToken?: string;
    }
  | { kind: "session-expired" };

export function getApiBaseUrl(): string {
  const base = process.env.API_BASE_URL;
  if (!base) {
    throw new Error(
      "API_BASE_URL belum diset. Salin .env.example ke .env.local.",
    );
  }
  return base.replace(/\/$/, "");
}

/** Header yang tidak boleh ikut diteruskan ke backend. */
const HEADER_DIBUANG = new Set([
  "host",
  "connection",
  "content-length",
  "cookie",
  "authorization",
  "accept-encoding",
]);

function backendHeaders(accessToken: string, extra?: Headers): Headers {
  const headers = new Headers();

  if (extra) {
    for (const [name, value] of extra.entries()) {
      if (HEADER_DIBUANG.has(name.toLowerCase())) continue;
      headers.set(name, value);
    }
  }

  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return headers;
}

async function callBackend(
  input: ForwardInput,
  accessToken: string,
  extraHeaders?: Headers,
): Promise<Response> {
  const url = `${getApiBaseUrl()}${input.path}${input.search}`;

  return fetch(url, {
    method: input.method,
    headers: backendHeaders(accessToken, extraHeaders),
    body: input.body ?? undefined,
    // Lapisan proxy tidak boleh menyimpan cache; kesegaran ditentukan
    // TanStack Query di sisi klien.
    cache: "no-store",
  });
}

/** Menukar refresh token dengan access token baru. `null` kalau ditolak. */
async function tukarRefreshToken(refreshToken: string): Promise<string | null> {
  if (!refreshToken) return null;

  const response = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });

  if (!response.ok) return null;

  const data = (await response.json()) as { access_token?: string };
  return data.access_token ?? null;
}

/** Menghabiskan body yang tidak terpakai supaya koneksi dilepas. */
async function buangBody(response: Response): Promise<void> {
  try {
    await response.text();
  } catch {
    // Body sudah tertutup atau terputus — tidak ada yang perlu dibereskan.
  }
}

export async function forwardToBackend(
  input: ForwardInput,
  extraHeaders?: Headers,
): Promise<ForwardResult> {
  if (!input.session) return { kind: "session-expired" };

  const pertama = await callBackend(
    input,
    input.session.accessToken,
    extraHeaders,
  );

  if (pertama.status !== 401) {
    return { kind: "ok", response: pertama };
  }

  // Body response pertama tidak dipakai lagi — habiskan supaya koneksi tidak
  // menggantung saat kita menembak ulang.
  await buangBody(pertama);

  const tokenBaru = await tukarRefreshToken(input.session.refreshToken);
  if (!tokenBaru) return { kind: "session-expired" };

  const kedua = await callBackend(input, tokenBaru, extraHeaders);

  // Kalau setelah token segar pun masih 401, masalahnya bukan kedaluwarsa.
  // Berhenti di sini — mengulang refresh hanya akan jadi lingkaran.
  if (kedua.status === 401) {
    await buangBody(kedua);
    return { kind: "session-expired" };
  }

  return { kind: "ok", response: kedua, refreshedAccessToken: tokenBaru };
}
