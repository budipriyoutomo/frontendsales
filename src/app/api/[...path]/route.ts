import { NextResponse, type NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/api/bff";
import { clearSession, readSession, writeSession } from "@/lib/auth/session";

/**
 * Proxy umum BFF (keputusan 0.2).
 *
 * Semua endpoint backend selain `/api/auth/*` lewat sini. Browser mengirim
 * cookie; handler ini yang menempelkan Bearer dan mengurus refresh 401.
 *
 * Route yang lebih spesifik (mis. `app/api/auth/login/route.ts`) menang atas
 * catch-all ini, jadi endpoint auth tetap ditangani handler sendiri.
 */

/**
 * FastAPI mendaftarkan koleksi ini dengan trailing slash (`/api/sales/`).
 * Tanpa slash, FastAPI menjawab 307 dan kita membayar satu hop ekstra.
 */
const BACKEND_TRAILING_SLASH = new Set(["/api/sales"]);

/**
 * Endpoint yang sengaja tidak boleh dipanggil browser lewat proxy:
 * refresh token tidak pernah keluar dari server, dan jalur mesin POS
 * (API key, bukan JWT) bukan urusan dashboard.
 */
const DILARANG = new Set([
  "/api/auth/refresh",
  "/api/sync/sales",
  "/api/sales/publish",
]);

function responseHeaders(dari: Headers): Headers {
  const headers = new Headers();
  for (const [name, value] of dari.entries()) {
    const key = name.toLowerCase();
    // Body sudah didekode oleh fetch; meneruskan header encoding/panjang
    // dari backend akan membuat browser salah membaca isinya.
    if (
      key === "content-encoding" ||
      key === "content-length" ||
      key === "transfer-encoding" ||
      key === "connection"
    ) {
      continue;
    }
    headers.set(name, value);
  }
  return headers;
}

async function handle(
  request: NextRequest,
  ctx: RouteContext<"/api/[...path]">,
): Promise<NextResponse> {
  const { path } = await ctx.params;
  let backendPath = `/api/${path.join("/")}`;

  if (DILARANG.has(backendPath)) {
    return NextResponse.json(
      { detail: "Endpoint ini tidak tersedia lewat dashboard." },
      { status: 404 },
    );
  }

  if (BACKEND_TRAILING_SLASH.has(backendPath)) backendPath += "/";

  // Body dibaca jadi teks sekali di sini supaya bisa dikirim ulang kalau
  // request pertama kena 401 dan perlu diulang dengan token baru.
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? null
      : await request.text();

  const hasil = await forwardToBackend(
    {
      path: backendPath,
      search: request.nextUrl.search,
      method: request.method,
      body: body === "" ? null : body,
      session: await readSession(),
    },
    request.headers,
  );

  if (hasil.kind === "session-expired") {
    await clearSession();
    return NextResponse.json(
      { detail: "Sesi berakhir. Silakan masuk lagi." },
      { status: 401 },
    );
  }

  if (hasil.refreshedAccessToken) {
    await writeSession({ accessToken: hasil.refreshedAccessToken });
  }

  return new NextResponse(hasil.response.body, {
    status: hasil.response.status,
    headers: responseHeaders(hasil.response.headers),
  });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
