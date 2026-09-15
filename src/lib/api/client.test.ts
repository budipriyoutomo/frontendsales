import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { ApiError, createApiClient } from "@/lib/api/client";

const BASE = "http://api.test";

function client(token?: string | null) {
  return createApiClient({ baseUrl: BASE, getToken: () => token ?? null });
}

describe("createApiClient — header auth (1.10)", () => {
  it("menempelkan header Authorization saat token ada", async () => {
    let seen: string | null = "TIDAK DIPANGGIL";
    server.use(
      http.get(`${BASE}/api/auth/me`, ({ request }) => {
        seen = request.headers.get("authorization");
        return HttpResponse.json({ id: 1, email: "a@b.c" });
      }),
    );

    await client("token-abc").request("/api/auth/me");

    expect(seen).toBe("Bearer token-abc");
  });

  it("tidak menempelkan header Authorization saat token tidak ada", async () => {
    let seen: string | null = "TIDAK DIPANGGIL";
    server.use(
      http.post(`${BASE}/api/auth/login`, ({ request }) => {
        seen = request.headers.get("authorization");
        return HttpResponse.json({ access_token: "x" });
      }),
    );

    await client(null).request("/api/auth/login", { method: "POST" });

    expect(seen).toBeNull();
  });

  it("mengambil token lewat getToken di tiap request, bukan sekali saat dibuat", async () => {
    const tokens = ["token-lama", "token-baru"];
    const c = createApiClient({
      baseUrl: BASE,
      getToken: () => tokens.shift() ?? null,
    });
    const dilihat: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/auth/me`, ({ request }) => {
        dilihat.push(request.headers.get("authorization"));
        return HttpResponse.json({ id: 1 });
      }),
    );

    await c.request("/api/auth/me");
    await c.request("/api/auth/me");

    expect(dilihat).toEqual(["Bearer token-lama", "Bearer token-baru"]);
  });
});

describe("createApiClient — membongkar dua bentuk response (1.11)", () => {
  it("membongkar {success, data} menjadi data", async () => {
    server.use(
      http.get(`${BASE}/api/sales/summary`, () =>
        HttpResponse.json({
          success: true,
          data: { total_transactions: 14, total_amount: 4418375 },
        }),
      ),
    );

    const hasil = await client("t").request<{ total_amount: number }>(
      "/api/sales/summary",
    );

    expect(hasil).toEqual({ total_transactions: 14, total_amount: 4418375 });
  });

  it("mengembalikan objek polos apa adanya (endpoint /api/auth/*)", async () => {
    const tokenResponse = {
      access_token: "acc",
      refresh_token: "ref",
      token_type: "bearer",
      expires_in: 1800,
      user: { id: 1, email: "a@b.c", role: "admin" },
    };
    server.use(
      http.post(`${BASE}/api/auth/login`, () =>
        HttpResponse.json(tokenResponse),
      ),
    );

    const hasil = await client(null).request("/api/auth/login", {
      method: "POST",
      body: { email: "a@b.c", password: "rahasia" },
    });

    expect(hasil).toEqual(tokenResponse);
  });

  it("tidak salah mengira objek polos ber-field data sebagai amplop", async () => {
    // Tanpa `success`, `{data: ...}` bukan amplop — jangan dibongkar.
    server.use(
      http.get(`${BASE}/api/aneh`, () => HttpResponse.json({ data: 42 })),
    );

    expect(await client("t").request("/api/aneh")).toEqual({ data: 42 });
  });

  it("membongkar amplop array dan tetap menyimpan pagination", async () => {
    server.use(
      http.get(`${BASE}/api/sales/`, () =>
        HttpResponse.json({
          success: true,
          data: [{ transaction_id: "T1" }],
          pagination: { limit: 50, offset: 0, total: 1, has_more: false },
        }),
      ),
    );

    const c = client("t");
    expect(await c.request("/api/sales/")).toEqual([{ transaction_id: "T1" }]);

    const denganMeta = await c.requestWithMeta("/api/sales/");
    expect(denganMeta.data).toEqual([{ transaction_id: "T1" }]);
    expect(denganMeta.pagination).toEqual({
      limit: 50,
      offset: 0,
      total: 1,
      has_more: false,
    });
  });
});

describe("createApiClient — field di luar amplop (6.5)", () => {
  it("tetap memberi akses ke field sebelah `data`, mis. api_key mentah", async () => {
    // `POST /api/api-keys` menaruh key mentah di SAMPING `data`, bukan di
    // dalamnya. Kalau client hanya mengembalikan `data`, key itu hilang —
    // dan key mentah hanya muncul sekali seumur hidup.
    server.use(
      http.post(`${BASE}/api/api-keys`, () =>
        HttpResponse.json(
          {
            success: true,
            data: {
              outlet_code: "OUT1",
              key_prefix: "mhr_abc",
              is_active: true,
            },
            api_key: "mhr_abc123rahasia",
            message: "dibuat",
          },
          { status: 201 },
        ),
      ),
    );

    const hasil = await client("t").requestWithMeta<{ outlet_code: string }>(
      "/api/api-keys",
      { method: "POST", body: { outlet_code: "OUT1" } },
    );

    expect(hasil.data.outlet_code).toBe("OUT1");
    expect((hasil.body as { api_key: string }).api_key).toBe(
      "mhr_abc123rahasia",
    );
  });

  it("body juga tersedia untuk response objek polos", async () => {
    server.use(
      http.get(`${BASE}/api/auth/me`, () =>
        HttpResponse.json({ id: 1, email: "a@b.c" }),
      ),
    );

    const hasil = await client("t").requestWithMeta("/api/auth/me");

    expect(hasil.body).toEqual({ id: 1, email: "a@b.c" });
  });
});

describe("createApiClient — query string", () => {
  it("merangkai query dan membuang nilai kosong", async () => {
    let url = "";
    server.use(
      http.get(`${BASE}/api/sales/`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ success: true, data: [] });
      }),
    );

    await client("t").request("/api/sales/", {
      query: {
        outlet: "OUT1",
        start_date: "2026-01-01",
        end_date: undefined,
        product_group: null,
        limit: 50,
        offset: 0,
      },
    });

    const q = new URL(url).searchParams;
    expect(q.get("outlet")).toBe("OUT1");
    expect(q.get("start_date")).toBe("2026-01-01");
    expect(q.get("limit")).toBe("50");
    expect(q.get("offset")).toBe("0");
    expect(q.has("end_date")).toBe(false);
    expect(q.has("product_group")).toBe(false);
  });
});

describe("createApiClient — penanganan error seragam (1.6)", () => {
  it("melempar ApiError dengan status dan pesan dari {detail}", async () => {
    server.use(
      http.get(`${BASE}/api/users`, () =>
        HttpResponse.json({ detail: "Akses ditolak" }, { status: 403 }),
      ),
    );

    const err = await client("t")
      .request("/api/users")
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(403);
    expect((err as ApiError).message).toBe("Akses ditolak");
  });

  it("membaca Retry-After pada 429 (2.6)", async () => {
    server.use(
      http.post(`${BASE}/api/auth/login`, () =>
        HttpResponse.json(
          { detail: "Terlalu banyak percobaan login. Coba lagi nanti." },
          { status: 429, headers: { "Retry-After": "300" } },
        ),
      ),
    );

    const err = (await client(null)
      .request("/api/auth/login", { method: "POST" })
      .catch((e) => e)) as ApiError;

    expect(err.status).toBe(429);
    expect(err.retryAfterSeconds).toBe(300);
  });

  it("meratakan detail validasi 422 menjadi pesan per field", async () => {
    server.use(
      http.post(`${BASE}/api/users`, () =>
        HttpResponse.json(
          {
            detail: [
              {
                loc: ["body", "outlet_code"],
                msg: "outlet_code wajib untuk role outlet",
                type: "value_error",
              },
            ],
          },
          { status: 422 },
        ),
      ),
    );

    const err = (await client("t")
      .request("/api/users", { method: "POST", body: {} })
      .catch((e) => e)) as ApiError;

    expect(err.status).toBe(422);
    expect(err.fieldErrors).toEqual({
      outlet_code: "outlet_code wajib untuk role outlet",
    });
    expect(err.message).toContain("outlet_code wajib untuk role outlet");
  });

  it("tetap melempar ApiError saat body error bukan JSON", async () => {
    server.use(
      http.get(`${BASE}/api/sales/`, () =>
        HttpResponse.text("Bad Gateway", { status: 502 }),
      ),
    );

    const err = (await client("t")
      .request("/api/sales/")
      .catch((e) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.message).not.toBe("");
  });

  it("mengembalikan null untuk 204 tanpa isi", async () => {
    server.use(
      http.post(
        `${BASE}/api/auth/logout`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    expect(
      await client("t").request("/api/auth/logout", { method: "POST" }),
    ).toBeNull();
  });
});

describe("createApiClient — body JSON", () => {
  it("mengirim body sebagai JSON dengan Content-Type", async () => {
    let ct: string | null = null;
    let body: unknown = null;
    server.use(
      http.post(`${BASE}/api/api-keys`, async ({ request }) => {
        ct = request.headers.get("content-type");
        body = await request.json();
        return HttpResponse.json(
          { success: true, data: { api_key: "k" } },
          { status: 201 },
        );
      }),
    );

    await client("t").request("/api/api-keys", {
      method: "POST",
      body: { outlet_code: "OUT1" },
    });

    expect(ct).toContain("application/json");
    expect(body).toEqual({ outlet_code: "OUT1" });
  });

  it("requestRaw mengembalikan Response mentah untuk CSV (5.4)", async () => {
    server.use(
      http.get(`${BASE}/api/sales/export`, () =>
        HttpResponse.text("a,b\n1,2", {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": 'attachment; filename="sales.csv"',
          },
        }),
      ),
    );

    const res = await client("t").requestRaw("/api/sales/export");

    expect(res.ok).toBe(true);
    expect(res.headers.get("content-disposition")).toContain("sales.csv");
    expect(await res.text()).toBe("a,b\n1,2");
  });
});
