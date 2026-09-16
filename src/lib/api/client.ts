/**
 * Client HTTP terpusat (TODO 1.6).
 *
 * Satu tempat untuk base URL, header auth, dan penanganan error — supaya
 * setiap pemanggil tidak mengulang tiga hal yang sama dan berbeda-beda diam.
 *
 * Client ini dipakai di dua tempat dengan konfigurasi berbeda:
 *   - di server (Route Handler / Server Component) → baseUrl = FastAPI,
 *     token diambil dari cookie httpOnly;
 *   - di browser → baseUrl = "" (origin sendiri), tanpa token, karena
 *     cookie ikut otomatis dan Route Handler Next yang memasang Bearer.
 * Lihat keputusan 0.2 (BFF).
 */

export type QueryValue = string | number | boolean | null | undefined;

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Dikirim sebagai JSON. Nilai `undefined` berarti tanpa body. */
  body?: unknown;
  /**
   * Nilai `null`/`undefined`/string kosong dibuang, tidak dikirim.
   * Array dikirim sebagai param berulang (`?a=1&a=2`), bentuk yang dikenali
   * FastAPI untuk `List[str]` (TODO 10.10).
   */
  query?: Record<string, QueryValue | readonly QueryValue[]>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  cache?: RequestCache;
};

export type PaginationMeta = {
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
};

export type ApiClient = {
  /** Mengembalikan data yang sudah dibongkar dari amplop (kalau ada). */
  request<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
  /**
   * Sama, tapi ikut membawa `pagination` (Fase 5.2) dan `body` mentah.
   *
   * `body` diperlukan karena sebagian response menaruh field penting di
   * SAMPING `data`, bukan di dalamnya — `api_key` mentah pada pembuatan
   * dan rotasi key adalah satu-satunya kesempatan melihat nilai itu (6.5).
   */
  requestWithMeta<T = unknown>(
    path: string,
    options?: RequestOptions,
  ): Promise<{ data: T; pagination?: PaginationMeta; body: unknown }>;
  /** Response mentah — untuk unduhan CSV (Fase 5.4). */
  requestRaw(path: string, options?: RequestOptions): Promise<Response>;
};

export type CreateApiClientOptions = {
  baseUrl: string;
  /**
   * Dipanggil **tiap request**, bukan sekali saat client dibuat — kalau tidak,
   * token yang sudah di-refresh tidak akan pernah terpakai.
   */
  getToken?: () =>
    string | null | undefined | Promise<string | null | undefined>;
  fetchImpl?: typeof fetch;
};

/** Satu entri `detail` dari 422 FastAPI. */
type ValidationDetail = {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
};

/**
 * Error tunggal untuk semua kegagalan HTTP, supaya UI cukup memeriksa satu
 * bentuk: `err.status` untuk cabang (401/403/409/422/429), `err.message`
 * untuk ditampilkan, `err.fieldErrors` untuk menempel pesan di field form.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;
  /** Hanya terisi pada 429 — dipakai untuk hitung mundur (TODO 2.6). */
  readonly retryAfterSeconds?: number;
  /** Hanya terisi pada 422 — nama field → pesan (TODO 6.16). */
  readonly fieldErrors?: Record<string, string>;

  constructor(init: {
    status: number;
    message: string;
    detail?: unknown;
    retryAfterSeconds?: number;
    fieldErrors?: Record<string, string>;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.detail = init.detail;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.fieldErrors = init.fieldErrors;
  }
}

/** Error jaringan / server mati — bukan response HTTP sama sekali. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    this.name = "NetworkError";
    this.cause = cause;
  }
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: RequestOptions["query"],
): string {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    const values: readonly QueryValue[] = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (value === null || value === undefined || value === "") continue;
      params.append(key, String(value));
    }
  }

  const qs = params.toString();
  return qs ? `${url}${url.includes("?") ? "&" : "?"}${qs}` : url;
}

/**
 * Amplop `{success, data}` hanya dikenali kalau **kedua** kunci ada.
 * `success` sendirian yang jadi penanda: objek polos seperti `{data: 42}`
 * bukan amplop dan harus lolos apa adanya (lihat 0.6).
 */
function isEnvelope(
  body: unknown,
): body is { success: boolean; data: unknown; pagination?: PaginationMeta } {
  return (
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    "success" in body &&
    "data" in body
  );
}

function parseFieldErrors(detail: unknown): Record<string, string> | undefined {
  if (!Array.isArray(detail)) return undefined;

  const fields: Record<string, string> = {};
  for (const item of detail as ValidationDetail[]) {
    if (!item || typeof item !== "object") continue;
    // `loc` berbentuk ["body", "outlet_code"] — bagian terakhir nama fieldnya.
    const name = item.loc?.[item.loc.length - 1];
    if (name === undefined) continue;
    fields[String(name)] = item.msg ?? "Nilai tidak valid";
  }

  return Object.keys(fields).length > 0 ? fields : undefined;
}

function parseRetryAfter(response: Response): number | undefined {
  const raw = response.headers.get("retry-after");
  if (!raw) return undefined;

  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return seconds;

  // Bentuk HTTP-date juga sah menurut spec, walau backend kita kirim detik.
  const at = Date.parse(raw);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, Math.ceil((at - Date.now()) / 1000));
}

const PESAN_STATUS: Record<number, string> = {
  400: "Permintaan tidak dapat diproses.",
  401: "Sesi berakhir. Silakan masuk lagi.",
  403: "Anda tidak punya akses ke data ini.",
  404: "Data tidak ditemukan.",
  409: "Data sudah ada.",
  422: "Ada isian yang belum benar.",
  429: "Terlalu banyak percobaan. Coba lagi sebentar.",
  500: "Terjadi kesalahan di server.",
  502: "Server tidak dapat dihubungi.",
  503: "Layanan sedang tidak tersedia.",
};

function messageFromDetail(detail: unknown, status: number): string {
  if (typeof detail === "string" && detail.trim() !== "") return detail;

  const fields = parseFieldErrors(detail);
  if (fields) return Object.values(fields).join(", ");

  return PESAN_STATUS[status] ?? `Permintaan gagal (HTTP ${status}).`;
}

async function toApiError(response: Response): Promise<ApiError> {
  let detail: unknown;
  try {
    const text = await response.text();
    if (text) {
      try {
        const parsed = JSON.parse(text) as unknown;
        detail =
          typeof parsed === "object" && parsed !== null && "detail" in parsed
            ? (parsed as { detail: unknown }).detail
            : parsed;
      } catch {
        // Body bukan JSON (mis. halaman error proxy) — pakai pesan status.
        detail = undefined;
      }
    }
  } catch {
    detail = undefined;
  }

  return new ApiError({
    status: response.status,
    message: messageFromDetail(detail, response.status),
    detail,
    retryAfterSeconds:
      response.status === 429 ? parseRetryAfter(response) : undefined,
    fieldErrors: parseFieldErrors(detail),
  });
}

export function createApiClient(options: CreateApiClientOptions): ApiClient {
  const { baseUrl, getToken, fetchImpl } = options;

  async function requestRaw(
    path: string,
    opts: RequestOptions = {},
  ): Promise<Response> {
    const headers = new Headers(opts.headers);

    const token = getToken ? await getToken() : null;
    if (token) headers.set("Authorization", `Bearer ${token}`);

    let body: string | undefined;
    if (opts.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(opts.body);
    }

    const doFetch = fetchImpl ?? globalThis.fetch;

    try {
      return await doFetch(buildUrl(baseUrl, path, opts.query), {
        method: opts.method ?? "GET",
        headers,
        body,
        signal: opts.signal,
        cache: opts.cache,
        // Cookie sesi ikut saat client ini dipakai dari browser ke origin
        // sendiri; tidak berpengaruh saat dipakai server-ke-server.
        credentials: "include",
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError")
        throw cause;
      throw new NetworkError(cause);
    }
  }

  async function requestWithMeta<T = unknown>(
    path: string,
    opts: RequestOptions = {},
  ): Promise<{ data: T; pagination?: PaginationMeta; body: unknown }> {
    const response = await requestRaw(path, opts);

    if (!response.ok) throw await toApiError(response);

    if (response.status === 204) return { data: null as T, body: null };

    const text = await response.text();
    if (text === "") return { data: null as T, body: null };

    const parsed = JSON.parse(text) as unknown;

    if (isEnvelope(parsed)) {
      return {
        data: parsed.data as T,
        pagination: parsed.pagination,
        body: parsed,
      };
    }

    return { data: parsed as T, body: parsed };
  }

  async function request<T = unknown>(
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    return (await requestWithMeta<T>(path, opts)).data;
  }

  return { request, requestWithMeta, requestRaw };
}
