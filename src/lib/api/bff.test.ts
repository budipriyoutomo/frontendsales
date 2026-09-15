import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { forwardToBackend } from "@/lib/api/bff";

const BACKEND = "http://backend.test";

beforeEach(() => {
  process.env.API_BASE_URL = BACKEND;
});

function forward(
  init: Partial<Parameters<typeof forwardToBackend>[0]> = {},
): ReturnType<typeof forwardToBackend> {
  return forwardToBackend({
    path: "/api/sales/summary",
    search: "",
    method: "GET",
    body: null,
    session: { accessToken: "acc-lama", refreshToken: "ref-ok" },
    ...init,
  });
}

describe("forwardToBackend — penerusan dasar", () => {
  it("meneruskan path, query, method, body, dan Bearer dari cookie", async () => {
    let dilihat: { url: string; auth: string | null; body: unknown } | null =
      null;
    server.use(
      http.post(`${BACKEND}/api/api-keys`, async ({ request }) => {
        dilihat = {
          url: request.url,
          auth: request.headers.get("authorization"),
          body: await request.json(),
        };
        return HttpResponse.json({ success: true, data: {} }, { status: 201 });
      }),
    );

    const hasil = await forward({
      path: "/api/api-keys",
      search: "?x=1",
      method: "POST",
      body: JSON.stringify({ outlet_code: "OUT1" }),
    });

    expect(hasil.kind).toBe("ok");
    expect(dilihat!.auth).toBe("Bearer acc-lama");
    expect(new URL(dilihat!.url).searchParams.get("x")).toBe("1");
    expect(dilihat!.body).toEqual({ outlet_code: "OUT1" });
  });

  it("meneruskan status dan body error selain 401 apa adanya", async () => {
    server.use(
      http.get(`${BACKEND}/api/users`, () =>
        HttpResponse.json({ detail: "Akses ditolak" }, { status: 403 }),
      ),
    );

    const hasil = await forward({ path: "/api/users" });

    expect(hasil.kind).toBe("ok");
    if (hasil.kind !== "ok") return;
    expect(hasil.response.status).toBe(403);
    await expect(hasil.response.json()).resolves.toEqual({
      detail: "Akses ditolak",
    });
  });

  it("meneruskan CSV beserta Content-Disposition (5.4)", async () => {
    server.use(
      http.get(`${BACKEND}/api/sales/export`, () =>
        HttpResponse.text("a,b\n1,2", {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="sales.csv"',
          },
        }),
      ),
    );

    const hasil = await forward({ path: "/api/sales/export" });

    expect(hasil.kind).toBe("ok");
    if (hasil.kind !== "ok") return;
    expect(hasil.response.headers.get("content-type")).toContain("text/csv");
    expect(hasil.response.headers.get("content-disposition")).toContain(
      "sales.csv",
    );
    await expect(hasil.response.text()).resolves.toBe("a,b\n1,2");
  });
});

describe("forwardToBackend — refresh otomatis saat 401 (2.5, 2.12)", () => {
  it("me-refresh sekali lalu mengulang request dengan token baru", async () => {
    const authDilihat: (string | null)[] = [];
    let refreshDipanggil = 0;

    server.use(
      http.get(`${BACKEND}/api/sales/summary`, ({ request }) => {
        const auth = request.headers.get("authorization");
        authDilihat.push(auth);
        if (auth === "Bearer acc-baru") {
          return HttpResponse.json({ success: true, data: { total: 1 } });
        }
        return HttpResponse.json(
          { detail: "Token kedaluwarsa" },
          { status: 401 },
        );
      }),
      http.post(`${BACKEND}/api/auth/refresh`, async ({ request }) => {
        refreshDipanggil += 1;
        expect(await request.json()).toEqual({ refresh_token: "ref-ok" });
        return HttpResponse.json({
          access_token: "acc-baru",
          token_type: "bearer",
          expires_in: 1800,
        });
      }),
    );

    const hasil = await forward();

    expect(refreshDipanggil).toBe(1);
    expect(authDilihat).toEqual(["Bearer acc-lama", "Bearer acc-baru"]);
    expect(hasil.kind).toBe("ok");
    if (hasil.kind !== "ok") return;
    expect(hasil.refreshedAccessToken).toBe("acc-baru");
    expect(hasil.response.status).toBe(200);
    await expect(hasil.response.json()).resolves.toEqual({
      success: true,
      data: { total: 1 },
    });
  });

  it("mengulang request POST dengan body yang sama, tidak kosong", async () => {
    const bodyDilihat: unknown[] = [];
    server.use(
      http.post(`${BACKEND}/api/api-keys`, async ({ request }) => {
        const auth = request.headers.get("authorization");
        bodyDilihat.push(await request.json());
        if (auth === "Bearer acc-baru") {
          return HttpResponse.json(
            { success: true, data: {} },
            { status: 201 },
          );
        }
        return HttpResponse.json({ detail: "kedaluwarsa" }, { status: 401 });
      }),
      http.post(`${BACKEND}/api/auth/refresh`, () =>
        HttpResponse.json({ access_token: "acc-baru", expires_in: 1800 }),
      ),
    );

    const hasil = await forward({
      path: "/api/api-keys",
      method: "POST",
      body: JSON.stringify({ outlet_code: "OUT1" }),
    });

    expect(hasil.kind).toBe("ok");
    expect(bodyDilihat).toEqual([
      { outlet_code: "OUT1" },
      { outlet_code: "OUT1" },
    ]);
  });
});

describe("forwardToBackend — refresh gagal (2.13)", () => {
  it("melaporkan sesi habis saat refresh ditolak", async () => {
    server.use(
      http.get(`${BACKEND}/api/sales/summary`, () =>
        HttpResponse.json({ detail: "kedaluwarsa" }, { status: 401 }),
      ),
      http.post(`${BACKEND}/api/auth/refresh`, () =>
        HttpResponse.json(
          { detail: "Refresh token tidak valid" },
          { status: 401 },
        ),
      ),
    );

    const hasil = await forward();

    expect(hasil.kind).toBe("session-expired");
  });

  it("melaporkan sesi habis saat tidak ada refresh token sama sekali", async () => {
    server.use(
      http.get(`${BACKEND}/api/sales/summary`, () =>
        HttpResponse.json({ detail: "kedaluwarsa" }, { status: 401 }),
      ),
    );

    const hasil = await forward({
      session: { accessToken: "acc-lama", refreshToken: "" },
    });

    expect(hasil.kind).toBe("session-expired");
  });

  it("tidak mencoba refresh berulang kali kalau request ulang tetap 401", async () => {
    let refreshDipanggil = 0;
    let requestDipanggil = 0;
    server.use(
      http.get(`${BACKEND}/api/sales/summary`, () => {
        requestDipanggil += 1;
        return HttpResponse.json({ detail: "kedaluwarsa" }, { status: 401 });
      }),
      http.post(`${BACKEND}/api/auth/refresh`, () => {
        refreshDipanggil += 1;
        return HttpResponse.json({
          access_token: "acc-baru",
          expires_in: 1800,
        });
      }),
    );

    const hasil = await forward();

    expect(hasil.kind).toBe("session-expired");
    expect(refreshDipanggil).toBe(1);
    expect(requestDipanggil).toBe(2);
  });

  it("melaporkan sesi habis saat tidak ada sesi sama sekali", async () => {
    const hasil = await forward({ session: null });

    expect(hasil.kind).toBe("session-expired");
  });
});
