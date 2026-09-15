import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";
import { REFRESH_COOKIE } from "@/lib/auth/cookie-names";

function permintaan(path: string, opts: { masuk?: boolean } = {}) {
  const request = new NextRequest(`http://localhost:3000${path}`);
  if (opts.masuk) request.cookies.set(REFRESH_COOKIE, "ref-token");
  return request;
}

describe("proxy — penjaga halaman (2.3, 2.14)", () => {
  it("melempar ke /login saat membuka halaman terlindungi tanpa sesi", () => {
    const res = proxy(permintaan("/dashboard"));

    expect(res.status).toBe(307);
    const tujuan = new URL(res.headers.get("location")!);
    expect(tujuan.pathname).toBe("/login");
  });

  it("mengingat halaman tujuan supaya bisa dikembalikan setelah login", () => {
    const res = proxy(permintaan("/transaksi"));

    const tujuan = new URL(res.headers.get("location")!);
    expect(tujuan.searchParams.get("next")).toBe("/transaksi");
  });

  it("membiarkan halaman terlindungi terbuka saat sesi ada", () => {
    const res = proxy(permintaan("/dashboard", { masuk: true }));

    expect(res.headers.get("location")).toBeNull();
  });

  it("tidak menahan halaman /login sendiri", () => {
    const res = proxy(permintaan("/login"));

    expect(res.headers.get("location")).toBeNull();
  });

  it("memindahkan yang sudah masuk dari /login ke dashboard", () => {
    const res = proxy(permintaan("/login", { masuk: true }));

    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("mengarahkan akar situs ke dashboard saat sudah masuk", () => {
    const res = proxy(permintaan("/", { masuk: true }));

    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("mengarahkan akar situs ke login saat belum masuk", () => {
    const res = proxy(permintaan("/"));

    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });
});

describe("proxy — matcher", () => {
  // Yang menentukan proxy jalan atau tidak adalah matcher, bukan isi fungsi.
  // Jadi yang diuji regexnya langsung.
  const cocok = (path: string) =>
    config.matcher.some((pola) => new RegExp(`^${pola}$`).test(path));

  it("tidak jalan di Route Handler /api — 401 di sana urusan proxy BFF", () => {
    expect(cocok("/api/sales/summary")).toBe(false);
    expect(cocok("/api/auth/login")).toBe(false);
  });

  it("tidak jalan di aset statis Next", () => {
    expect(cocok("/_next/static/chunk.js")).toBe(false);
    expect(cocok("/_next/image")).toBe(false);
    expect(cocok("/favicon.ico")).toBe(false);
  });

  it("jalan di halaman biasa", () => {
    expect(cocok("/dashboard")).toBe(true);
    expect(cocok("/login")).toBe(true);
    expect(cocok("/transaksi")).toBe(true);
  });

  it("tetap jalan di halaman yang namanya berawalan 'api'", () => {
    // `/api-keys` adalah HALAMAN, bukan Route Handler. Pengecualian yang
    // ditulis sebagai `(?!api...)` tanpa batas segmen ikut membuang halaman
    // ini, dan akibatnya `next=` menunjuk ke tujuan yang salah.
    expect(cocok("/api-keys")).toBe(true);
    expect(cocok("/api-keys/OUT1")).toBe(true);
  });
});
