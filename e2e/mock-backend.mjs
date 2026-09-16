/**
 * Backend tiruan untuk E2E (TODO 8.1–8.3).
 *
 * Meniru kontrak FastAPI seperlunya, supaya Playwright bisa menguji
 * **seluruh** lapisan frontend — `proxy.ts`, Route Handler, cookie httpOnly,
 * refresh 401, sampai React — tanpa menuntut Postgres dan user ter-seed.
 *
 * Yang TIDAK diuji di sini cuma FastAPI itu sendiri; kontraknya sudah
 * diverifikasi terpisah ke server sungguhan.
 *
 * Bentuk response sengaja dijaga persis seperti aslinya:
 *   - `/api/auth/*` mengembalikan objek polos
 *   - selebihnya dibungkus `{success, data}`
 *   - `POST /api/api-keys` menaruh `api_key` di SAMPING `data`
 * Kalau ketiganya ikut "dirapikan", E2E-nya jadi menguji khayalan.
 */

import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 8788);

/** Akun uji, satu per role. */
const USERS = {
  "admin@maharasa.test": {
    id: 1,
    email: "admin@maharasa.test",
    full_name: "Admin Uji",
    role: "admin",
    outlet_code: null,
    is_active: true,
    password: "rahasia123",
  },
  "manager@maharasa.test": {
    id: 2,
    email: "manager@maharasa.test",
    full_name: "Manager Uji",
    role: "manager",
    outlet_code: null,
    is_active: true,
    password: "rahasia123",
  },
  "outlet@maharasa.test": {
    id: 3,
    email: "outlet@maharasa.test",
    full_name: "Kasir Uji",
    role: "outlet",
    outlet_code: "OUTLET_001",
    is_active: true,
    password: "rahasia123",
  },
  // Akun yang passwordnya masih ditentukan admin — dipakai menguji paksaan
  // ganti password di login pertama (TODO 2.8).
  "baru@maharasa.test": {
    id: 4,
    email: "baru@maharasa.test",
    full_name: "User Baru",
    role: "manager",
    outlet_code: null,
    is_active: true,
    password: "sementara123",
    must_change_password: true,
  },
};

/** Bentuk `UserResponse` — tanpa password, persis seperti backend. */
function profil(u) {
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    outlet_code: u.outlet_code,
    is_active: u.is_active,
    must_change_password: u.must_change_password === true,
  };
}

/** Token buatan: `<email>|<jenis>`. Cukup untuk menguji alur, bukan kripto. */
const buatToken = (email, jenis) => `${email}|${jenis}`;

function bacaToken(header) {
  const raw = (header ?? "").replace(/^Bearer\s+/i, "");
  const [email, jenis] = raw.split("|");
  const user = USERS[email];
  if (!user || jenis !== "access") return null;
  return user;
}

/** Keadaan yang berubah selama satu kali jalan test. */
const state = {
  apiKeys: [
    {
      outlet_code: "OUTLET_001",
      key_prefix: "mhr_aaa111",
      is_active: true,
      created_at: "2026-09-01T08:00:00",
      updated_at: null,
    },
  ],
  users: Object.values(USERS).map(profil).map((u) => ({
    ...u,
    created_at: "2026-09-01T08:00:00",
    updated_at: null,
  })),
  /** Group yang dipublish (TODO Fase 10). */
  productGroups: [
    {
      id: 1,
      product_group: "COLORPLATE",
      is_active: true,
      created_at: "2026-09-01T08:00:00",
      updated_at: null,
    },
  ],
  /** Dinyalakan test untuk memaksa access token berikutnya ditolak (2.12). */
  paksa401Sekali: false,
};

/** Sama dengan `normalize_product_group` di backend: hanya SPASI di ujung. */
const normalGroup = (v) => String(v ?? "").replace(/^ +| +$/g, "").toUpperCase();

/** Group yang ADA di data penjualan — beda dengan yang dipublish. */
const GROUP_DI_DATA = ["COLORPLATE", "MAKANAN", "MINUMAN"];

const REKAP_GROUP = [
  {
    product_group: "COLORPLATE",
    product_name: "Piring Merah",
    outlet_code: "OUTLET_001",
    sale_date: "2026-09-12",
    sold: 4,
  },
  {
    product_group: "COLORPLATE",
    product_name: "Piring Biru",
    outlet_code: "OUTLET_002",
    sale_date: "2026-09-12",
    sold: 2.5,
  },
  {
    product_group: "MINUMAN",
    product_name: "Es Teh Manis",
    outlet_code: "OUTLET_001",
    sale_date: "2026-09-11",
    sold: 12,
  },
];

const SALES = Array.from({ length: 120 }, (_, i) => ({
  transaction_id: i + 1,
  outlet_code: i % 2 === 0 ? "OUTLET_001" : "OUTLET_002",
  shop_id: 1,
  receipt_id: i + 1,
  reference_no: `REF-${String(i + 1).padStart(4, "0")}`,
  sale_date: "2026-09-12",
  paid_time: "2026-09-12T10:00:00",
  receipt_total_amount: 3,
  receipt_pay_price: 150000 + i * 1000,
  receipt_discount: 0,
  transaction_status_id: 2,
  void_staff_id: 0,
  // Satu transaksi sengaja void, untuk menguji penandanya (5.5).
  // Kolomnya `Deleted` — sama dengan yang dipakai endpoint laporan.
  deleted: i === 1 ? 1 : 0,
  created_at: null,
  updated_at: null,
}));

function json(res, status, body, headers = {}) {
  const teks = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(teks),
    ...headers,
  });
  res.end(teks);
}

const bungkus = (data, tambahan = {}) => ({ success: true, data, ...tambahan });

function tolak(res, status, detail) {
  json(res, status, { detail });
}

async function bacaBody(req) {
  const potongan = [];
  for await (const c of req) potongan.push(c);
  if (potongan.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(potongan).toString("utf8"));
  } catch {
    return {};
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method ?? "GET";

  // ---- publik -------------------------------------------------------
  if (path === "/health") return json(res, 200, { status: "ok" });

  if (path === "/api/auth/login" && method === "POST") {
    const body = await bacaBody(req);
    const user = USERS[String(body.email ?? "").toLowerCase()];

    if (body.password === "__RATE_LIMIT__") {
      return json(
        res,
        429,
        { detail: "Terlalu banyak percobaan login. Coba lagi nanti." },
        { "Retry-After": "300" },
      );
    }

    if (!user || user.password !== body.password) {
      return tolak(res, 401, "Email atau password salah");
    }

    return json(res, 200, {
      access_token: buatToken(user.email, "access"),
      refresh_token: buatToken(user.email, "refresh"),
      token_type: "bearer",
      expires_in: 1800,
      user: profil(user),
    });
  }

  if (path === "/api/auth/refresh" && method === "POST") {
    const body = await bacaBody(req);
    const [email, jenis] = String(body.refresh_token ?? "").split("|");
    if (!USERS[email] || jenis !== "refresh") {
      return tolak(res, 401, "Refresh token tidak valid");
    }
    return json(res, 200, {
      access_token: buatToken(email, "access"),
      token_type: "bearer",
      expires_in: 1800,
    });
  }

  // ---- mulai sini semuanya butuh Bearer -----------------------------
  const user = bacaToken(req.headers.authorization);
  if (!user) return tolak(res, 401, "Token tidak valid atau kedaluwarsa");

  // Satu kali 401 yang dipesan test, untuk membuktikan proxy BFF
  // benar-benar me-refresh lalu mengulang request (2.12).
  if (state.paksa401Sekali && path !== "/api/auth/me") {
    state.paksa401Sekali = false;
    return tolak(res, 401, "Token kedaluwarsa");
  }

  if (path === "/api/auth/me") return json(res, 200, profil(user));

  if (path === "/api/auth/logout" && method === "POST") {
    return json(res, 200, { success: true, message: "keluar" });
  }

  if (path === "/api/auth/change-password" && method === "POST") {
    const body = await bacaBody(req);
    if (body.current_password !== user.password) {
      return tolak(res, 400, "Kata sandi saat ini salah");
    }
    // Pemiliknya mengganti sendiri → penanda padam, persis seperti backend.
    user.password = body.new_password;
    user.must_change_password = false;
    return json(res, 200, { success: true, message: "diganti" });
  }

  // Endpoint khusus test — memesan satu 401 berikutnya.
  if (path === "/__paksa-401" && method === "POST") {
    state.paksa401Sekali = true;
    return json(res, 200, { success: true, message: "dipesan" });
  }

  // ---- penjaga role, meniru backend ---------------------------------
  const butuhAdmin =
    path.startsWith("/api/api-keys") ||
    path.startsWith("/api/users") ||
    path.startsWith("/api/product-groups");
  if (butuhAdmin && user.role !== "admin") {
    return tolak(res, 403, "Akses ditolak");
  }
  if (
    (path === "/api/sales/by-outlet" || path === "/api/outlets") &&
    user.role === "outlet"
  ) {
    return tolak(res, 403, "Akses ditolak");
  }

  // Untuk role outlet, scope diambil dari identitas — `?outlet=` diabaikan.
  const outletScope =
    user.role === "outlet" ? user.outlet_code : url.searchParams.get("outlet");

  // ---- penjualan ----------------------------------------------------
  if (path === "/api/sales/summary") {
    const baris = SALES.filter((s) => !outletScope || s.outlet_code === outletScope);
    const total = baris.reduce((n, s) => n + s.receipt_pay_price, 0);
    return json(
      res,
      200,
      bungkus({
        total_transactions: baris.length,
        total_amount: total,
        total_discount: 0,
        average_per_transaction: baris.length ? total / baris.length : 0,
      }),
    );
  }

  if (path === "/api/sales/daily") {
    return json(
      res,
      200,
      bungkus([
        { sale_date: "2026-09-10", total_transactions: 4, total_amount: 600000 },
        { sale_date: "2026-09-11", total_transactions: 6, total_amount: 900000 },
        { sale_date: "2026-09-12", total_transactions: 5, total_amount: 750000 },
      ]),
    );
  }

  if (path === "/api/sales/by-outlet") {
    return json(
      res,
      200,
      bungkus([
        { outlet_code: "OUTLET_001", total_transactions: 60, total_amount: 9000000 },
        { outlet_code: "OUTLET_002", total_transactions: 60, total_amount: 8100000 },
      ]),
    );
  }

  if (path === "/api/sales/top-products") {
    // Filter group dinormalisasi seperti by-group (backend TODO, 10.11).
    const group = normalGroup(url.searchParams.get("product_group"));
    return json(
      res,
      200,
      bungkus(
        [
          {
            product_id: 5,
            product_name: "Es Teh Manis",
            product_group: "Minuman",
            total_qty: 120,
            total_amount: 960000,
          },
          {
            product_id: 8,
            product_name: "Nasi Goreng",
            product_group: "Makanan",
            total_qty: 80,
            total_amount: 1600000,
          },
        ].filter((p) => !group || normalGroup(p.product_group) === group),
      ),
    );
  }

  if (path === "/api/sales/product-groups") {
    return json(res, 200, bungkus(GROUP_DI_DATA));
  }

  if (path === "/api/sales/by-group") {
    // Beberapa group = param berulang. Bentuk "A,B" sengaja TIDAK dipecah,
    // persis seperti FastAPI `List[str]` — supaya E2E menangkap kalau
    // frontend mengirim bentuk yang salah (10.17).
    const groups = url.searchParams.getAll("product_group").map(normalGroup);
    if (groups.length === 0) {
      return json(res, 422, {
        detail: [
          { loc: ["query", "product_group"], msg: "Field required", type: "missing" },
        ],
      });
    }
    return json(
      res,
      200,
      bungkus(
        REKAP_GROUP.filter(
          (r) =>
            groups.includes(r.product_group) &&
            (!outletScope || r.outlet_code === outletScope),
        ),
      ),
    );
  }

  if (path === "/api/sales/export") {
    const csv = "transaction_id,reference_no,receipt_pay_price\n1,REF-0001,150000\n";
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="transaksi_uji.csv"',
    });
    return res.end(csv);
  }

  if (path === "/api/sales/" || path === "/api/sales") {
    const semua = SALES.filter((s) => !outletScope || s.outlet_code === outletScope);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const potongan = semua.slice(offset, offset + limit);
    return json(
      res,
      200,
      bungkus(potongan, {
        pagination: {
          limit,
          offset,
          total: semua.length,
          has_more: offset + limit < semua.length,
        },
      }),
    );
  }

  const detail = /^\/api\/sales\/(\d+)$/.exec(path);
  if (detail) {
    const sale = SALES.find((s) => s.transaction_id === Number(detail[1]));
    if (!sale) return tolak(res, 404, "Transaksi tidak ditemukan");
    return json(
      res,
      200,
      bungkus({
        ...sale,
        items: [
          {
            order_detail_id: 1,
            transaction_id: sale.transaction_id,
            product_id: 5,
            product_group: "Minuman",
            product_dept: null,
            product_name: "Es Teh Manis",
            qty: 2,
            price: 8000,
            retail_price: 8000,
            order_status_id: 1,
            void_staff_id: 0,
            comment: null,
          },
        ],
      }),
    );
  }

  // ---- outlet -------------------------------------------------------
  if (path === "/api/outlets") {
    return json(
      res,
      200,
      bungkus([
        { outlet_code: "OUTLET_001", is_active: true },
        { outlet_code: "OUTLET_002", is_active: true },
      ]),
    );
  }

  if (path === "/api/outlets/sync-status") {
    const jamLalu = (n) => new Date(Date.now() - n * 3600_000).toISOString();
    return json(
      res,
      200,
      bungkus([
        {
          outlet_code: "OUTLET_001",
          last_synced_at: jamLalu(1),
          last_sale_date: "2026-09-12",
          total_transactions: 60,
        },
        {
          outlet_code: "OUTLET_002",
          last_synced_at: jamLalu(72),
          last_sale_date: "2026-09-09",
          total_transactions: 60,
        },
        {
          outlet_code: "OUTLET_003",
          last_synced_at: null,
          last_sale_date: null,
          total_transactions: 0,
        },
      ]),
    );
  }

  // ---- API key ------------------------------------------------------
  if (path === "/api/api-keys" && method === "GET") {
    return json(res, 200, bungkus(state.apiKeys));
  }

  if (path === "/api/api-keys" && method === "POST") {
    const body = await bacaBody(req);
    const kode = String(body.outlet_code ?? "").trim();
    if (state.apiKeys.some((k) => k.outlet_code === kode)) {
      return tolak(res, 409, "Outlet sudah memiliki API key");
    }
    const entri = {
      outlet_code: kode,
      key_prefix: `mhr_${kode.toLowerCase().slice(-6)}`,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: null,
    };
    state.apiKeys.push(entri);
    return json(
      res,
      201,
      bungkus(entri, { api_key: `mhr_baru_${kode}_rahasia`, message: "dibuat" }),
    );
  }

  const rotate = /^\/api\/api-keys\/([^/]+)\/rotate$/.exec(path);
  if (rotate && method === "POST") {
    const kode = decodeURIComponent(rotate[1]);
    const entri = state.apiKeys.find((k) => k.outlet_code === kode);
    if (!entri) return tolak(res, 404, "API key tidak ditemukan");
    entri.key_prefix = `mhr_rot${Date.now().toString().slice(-3)}`;
    entri.is_active = true;
    return json(
      res,
      200,
      bungkus(entri, { api_key: `mhr_rotasi_${kode}_rahasia`, message: "dirotasi" }),
    );
  }

  const revoke = /^\/api\/api-keys\/([^/]+)\/revoke$/.exec(path);
  if (revoke && method === "POST") {
    const kode = decodeURIComponent(revoke[1]);
    const entri = state.apiKeys.find((k) => k.outlet_code === kode);
    if (!entri) return tolak(res, 404, "API key tidak ditemukan");
    entri.is_active = false;
    return json(res, 200, { success: true, message: "dicabut" });
  }

  // ---- pengguna -----------------------------------------------------
  if (path === "/api/users" && method === "GET") {
    return json(res, 200, bungkus(state.users));
  }

  if (path === "/api/users" && method === "POST") {
    const body = await bacaBody(req);
    if (body.role === "outlet" && !body.outlet_code) {
      return json(res, 422, {
        detail: [
          {
            loc: ["body", "outlet_code"],
            msg: "outlet_code wajib untuk role outlet",
            type: "value_error",
          },
        ],
      });
    }
    if (state.users.some((u) => u.email === body.email)) {
      return json(res, 422, {
        detail: [
          { loc: ["body", "email"], msg: "Email sudah dipakai", type: "value_error" },
        ],
      });
    }
    const baru = {
      id: state.users.length + 10,
      email: body.email,
      full_name: body.full_name ?? null,
      role: body.role,
      outlet_code: body.outlet_code ?? null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: null,
    };
    state.users.push(baru);
    return json(res, 201, bungkus(baru));
  }

  const patch = /^\/api\/users\/(\d+)$/.exec(path);
  if (patch && method === "PATCH") {
    const target = state.users.find((u) => u.id === Number(patch[1]));
    if (!target) return tolak(res, 404, "User tidak ditemukan");
    const body = await bacaBody(req);
    if (target.id === user.id && body.is_active === false) {
      return tolak(res, 400, "Tidak bisa menonaktifkan akun sendiri");
    }
    Object.assign(target, body);
    return json(res, 200, bungkus(target));
  }

  const setPass = /^\/api\/users\/(\d+)\/password$/.exec(path);
  if (setPass && method === "POST") {
    return json(res, 200, { success: true, message: "direset" });
  }

  // ---- product group (Fase 10) --------------------------------------
  if (path === "/api/product-groups" && method === "GET") {
    const urut = [...state.productGroups].sort((a, b) =>
      a.product_group.localeCompare(b.product_group),
    );
    return json(res, 200, bungkus(urut));
  }

  if (path === "/api/product-groups" && method === "POST") {
    const body = await bacaBody(req);
    const normal = normalGroup(body.product_group);
    if (!normal) return tolak(res, 422, "product_group tidak boleh kosong");
    if (normal.length > 255) {
      return tolak(res, 422, "product_group maksimal 255 karakter");
    }
    if (state.productGroups.some((g) => g.product_group === normal)) {
      return tolak(
        res,
        409,
        `Product group '${normal}' sudah terdaftar. Aktifkan lewat PATCH kalau sedang nonaktif.`,
      );
    }
    const baru = {
      id: Math.max(0, ...state.productGroups.map((g) => g.id)) + 1,
      product_group: normal,
      is_active: body.is_active !== false,
      created_at: new Date().toISOString(),
      updated_at: null,
    };
    state.productGroups.push(baru);
    return json(res, 201, bungkus(baru));
  }

  const group = /^\/api\/product-groups\/(\d+)$/.exec(path);
  if (group && method === "DELETE") {
    // Backend tidak punya DELETE sama sekali.
    return tolak(res, 405, "Method Not Allowed");
  }
  if (group && method === "PATCH") {
    const target = state.productGroups.find((g) => g.id === Number(group[1]));
    if (!target) return tolak(res, 404, "Product group tidak ditemukan");
    const body = await bacaBody(req);
    if (typeof body.is_active !== "boolean") {
      return json(res, 422, {
        detail: [
          { loc: ["body", "is_active"], msg: "Field required", type: "missing" },
        ],
      });
    }
    target.is_active = body.is_active;
    target.updated_at = new Date().toISOString();
    return json(res, 200, bungkus(target));
  }

  return tolak(res, 404, `Tidak ada rute ${method} ${path}`);
});

server.listen(PORT, () => {
  console.log(`mock-backend siap di http://127.0.0.1:${PORT}`);
});
