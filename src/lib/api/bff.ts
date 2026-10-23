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
  /** Sinyal batal dari browser — request ke backend ikut dihentikan. */
  signal?: AbortSignal;
};

export type ForwardResult =
  | {
      kind: "ok";
      response: Response;
      /** Terisi kalau di tengah jalan token diperbarui — caller wajib
       *  menuliskannya kembali ke cookie. */
      refreshedAccessToken?: string;
    }
  | { kind: "session-expired" }
  /** Backend tidak menjawab dalam batas waktu (`BACKEND_TIMEOUT_MS`). */
  | { kind: "timeout" }
  /** Backend tidak bisa dihubungi sama sekali. */
  | { kind: "unreachable" }
  /** Browser membatalkan request (pindah halaman, ganti filter). */
  | { kind: "aborted" };

/**
 * Sedikit di atas `statement_timeout` backend (30 detik), supaya pesan 503
 * dari backend yang lebih jelas sempat sampai lebih dulu.
 */
const TIMEOUT_DEFAULT_MS = 35_000;
/** Export CSV memang menarik seluruh hasil filter — beri waktu lebih. */
const TIMEOUT_EXPORT_DEFAULT_MS = 120_000;
const PATH_EXPORT = new Set(["/api/sales/export"]);

function angkaEnv(nama: string, cadangan: number): number {
  const nilai = Number(process.env[nama]);
  return Number.isFinite(nilai) && nilai > 0 ? nilai : cadangan;
}

function batasWaktuMs(path: string): number {
  return PATH_EXPORT.has(path)
    ? angkaEnv("BACKEND_EXPORT_TIMEOUT_MS", TIMEOUT_EXPORT_DEFAULT_MS)
    : angkaEnv("BACKEND_TIMEOUT_MS", TIMEOUT_DEFAULT_MS);
}

/** Dilempar `callBackend`; diterjemahkan jadi `ForwardResult` di satu tempat. */
class GagalMenghubungi extends Error {
  constructor(
    readonly kind: "timeout" | "unreachable" | "aborted",
    options?: ErrorOptions,
  ) {
    super(kind, options);
  }
}

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
  const batas = AbortSignal.timeout(batasWaktuMs(input.path));
  const signal = input.signal ? AbortSignal.any([batas, input.signal]) : batas;

  try {
    return await fetch(url, {
      method: input.method,
      headers: backendHeaders(accessToken, extraHeaders),
      body: input.body ?? undefined,
      // Lapisan proxy tidak boleh menyimpan cache; kesegaran ditentukan
      // TanStack Query di sisi klien.
      cache: "no-store",
      signal,
    });
  } catch (cause) {
    if (input.signal?.aborted) throw new GagalMenghubungi("aborted");
    if (batas.aborted) throw new GagalMenghubungi("timeout");
    throw new GagalMenghubungi("unreachable", { cause });
  }
}

/** Menukar refresh token dengan access token baru. `null` kalau ditolak. */
async function tukarRefreshToken(refreshToken: string): Promise<string | null> {
  if (!refreshToken) return null;

  const batas = AbortSignal.timeout(
    angkaEnv("BACKEND_TIMEOUT_MS", TIMEOUT_DEFAULT_MS),
  );
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
      signal: batas,
    });
  } catch (cause) {
    // Backend bermasalah bukan berarti sesi habis — jangan hapus cookie.
    throw new GagalMenghubungi(batas.aborted ? "timeout" : "unreachable", {
      cause,
    });
  }

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
  try {
    return await teruskan(input, extraHeaders);
  } catch (err) {
    if (err instanceof GagalMenghubungi) return { kind: err.kind };
    throw err;
  }
}

async function teruskan(
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
