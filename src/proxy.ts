import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE } from "@/lib/auth/cookie-names";

/**
 * Penjaga halaman (TODO 2.3, 2.14).
 *
 * Sejak Next.js 16, Middleware bernama Proxy — perilakunya sama.
 *
 * Ini **pemeriksaan optimistis**: hanya melihat ada-tidaknya cookie sesi,
 * tidak memverifikasi token ke backend. Proxy jalan di setiap route termasuk
 * yang di-prefetch, jadi memanggil backend di sini akan mahal. Otorisasi yang
 * sebenarnya tetap dilakukan backend di tiap request, dan role diperiksa lagi
 * di halaman (Fase 3).
 */

const HALAMAN_PUBLIK = ["/login"];

/**
 * Server Component tidak bisa membaca pathname sendiri, padahal shell perlu
 * tahu halaman mana yang sedang dibuka (untuk menandai menu aktif dan untuk
 * `next=` saat sesi harus diperbarui). Jadi proxy menitipkannya lewat header.
 */
export const PATHNAME_HEADER = "x-pathname";

function teruskan(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const sudahMasuk = Boolean(request.cookies.get(REFRESH_COOKIE)?.value);

  // Akar situs bukan halaman, hanya persimpangan.
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(sudahMasuk ? "/dashboard" : "/login", request.url),
    );
  }

  const publik = HALAMAN_PUBLIK.some(
    (rute) => pathname === rute || pathname.startsWith(`${rute}/`),
  );

  if (publik) {
    // Yang sudah masuk tidak perlu melihat form login lagi.
    return sudahMasuk
      ? NextResponse.redirect(new URL("/dashboard", request.url))
      : teruskan(request);
  }

  if (!sudahMasuk) {
    const tujuan = new URL("/login", request.url);
    // Disimpan supaya setelah login user kembali ke halaman yang dia tuju,
    // bukan selalu terlempar ke dashboard.
    tujuan.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(tujuan);
  }

  return teruskan(request);
}

export const config = {
  /**
   * `/api/*` sengaja tidak dijaga di sini: proxy BFF sudah menjawab 401 dan
   * ikut mencoba refresh. Kalau proxy ini ikut menahan, request yang
   * sebenarnya masih bisa diselamatkan refresh akan mati lebih dulu.
   *
   * Perhatikan garis miringnya: `api/`, bukan `api`. Tanpa itu pengecualian
   * ini ikut memakan **halaman** `/api-keys`, yang membuat header pathname
   * tidak terpasang dan `next=` menunjuk ke dashboard alih-alih ke halaman
   * yang tadi dituju.
   */
  matcher: ["/((?!api/|_next/|favicon\.ico).*)"],
};
