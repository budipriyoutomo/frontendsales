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
  users: Object.values(USERS)
    .map(profil)
    .map((u) => ({
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
  /** Closing report dari RabbitMQ (Fase 11). SU-001 sengaja belum dipetakan. */
  closingMenus: [
    {
      id: 1,
      menu_code: "SU-001",
      menu_id: "0a1b2c3d-4e5f-4a7b-8c9d-0e1f2a3b4c51",
      menu_name: "Salmon Nigiri",
      brand_code: "MHR",
      products: [],
      first_seen_at: "2026-09-12T15:15:00",
      last_seen_at: "2026-09-12T15:15:00",
    },
    {
      id: 2,
      menu_code: "SU-002",
      menu_id: "0a1b2c3d-4e5f-4a7b-8c9d-0e1f2a3b4c52",
      menu_name: "Tuna Nigiri",
      brand_code: "MHR",
      products: [
        {
          id: 1,
          product_id: 200201,
          product_name: "Tuna HR",
          multiplier: 1,
          is_active: true,
          created_at: "2026-09-12T15:15:00",
          updated_at: null,
        },
      ],
      first_seen_at: "2026-09-12T15:15:00",
      last_seen_at: "2026-09-12T15:15:00",
    },
  ],
  /** Kiriman rekap closing ke API eksternal (backend Fase 8); API tujuan selalu 201. */
  closingExports: [],
  /** Dinyalakan test untuk memaksa access token berikutnya ditolak (2.12). */
  paksa401Sekali: false,
};

/** Produk POS yang bisa dipetakan + qty terjualnya per outlet (2026-09-12). */
const PRODUK_POS = [
  { product_id: 200104, product_name: "Salmon HR", product_group: "MAKANAN" },
  { product_id: 200201, product_name: "Tuna HR", product_group: "MAKANAN" },
];
/** Produk POS bukan colorplate — hanya tampil di perbandingan, tidak bisa dipetakan. */
const PRODUK_POS_LAIN = [
  { product_id: 300001, product_name: "Es Teh", product_group: "MINUMAN" },
];
const PRODUK_POS_INFO = Object.fromEntries(
  [...PRODUK_POS, ...PRODUK_POS_LAIN].map((p) => [p.product_id, p]),
);
const QTY_POS = {
  OUTLET_001: { 200104: 42, 200201: 10, 300001: 15 },
  OUTLET_002: { 200104: 5, 200201: 7 },
};

/** Item closing aktif per outlet: [menu_code, sold, waste, adjustment, compensation]. */
const CLOSING = {
  OUTLET_001: [
    ["SU-001", 42, 3, 0, 0],
    ["SU-002", 12, 0, 0, 0],
  ],
  OUTLET_002: [["SU-001", 5, 1, 0, 0]],
};
const TANGGAL_CLOSING = "2026-09-12";

function closingReportId(outlet) {
  return outlet === "OUTLET_001"
    ? "6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a01"
    : "6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a02";
}

function ringkasanClosing(outlet) {
  return {
    closing_report_id: closingReportId(outlet),
    report_date: TANGGAL_CLOSING,
    outlet_code: outlet,
    outlet_name: `Maharasa ${outlet}`,
    brand_code: "MHR",
    brand_name: "Maharasa",
    sent_at: "2026-09-12T15:15:00",
    received_at: "2026-09-12T15:15:01",
    revision_count: 1,
    item_count: CLOSING[outlet].length,
  };
}

const menuTampil = (m) => ({
  ...m,
  is_mapped: m.products.some((p) => p.is_active),
});

/** Log pesan RabbitMQ (`/api/closing-messages`): satu diterima, satu ditolak. */
const PESAN_CLOSING = [
  {
    id: 2,
    received_at: "2026-09-12T15:20:00",
    status: "ditolak",
    reason: "gagal validasi",
    warnings: null,
    message_id: "pesan-rusak-001",
    outlet_code: "OUTLET_002",
    closing_report_id: null,
    report_date: null,
    item_count: null,
    revision_id: null,
    body_bytes: 180,
    errors: [
      { type: "literal_error", loc: ["version"], msg: "Input should be 1" },
    ],
    payload: {
      event: "closingreport.submitted",
      version: 2,
      messageId: "pesan-rusak-001",
    },
    body_text: null,
  },
  {
    id: 1,
    received_at: "2026-09-12T15:15:02",
    status: "baru",
    reason: null,
    warnings: ["outlet belum terdaftar di api_keys"],
    message_id: "pesan-baik-001",
    outlet_code: "OUTLET_001",
    closing_report_id: null,
    report_date: TANGGAL_CLOSING,
    item_count: 2,
    revision_id: 1,
    body_bytes: 640,
    errors: null,
    payload: {
      event: "closingreport.submitted",
      version: 1,
      messageId: "pesan-baik-001",
    },
    body_text: null,
  },
];

/**
 * Meniru `compare_with_pos`: satu baris per menu colorplate; POS = Σ qty
 * produk POS yang dipetakan ke menu itu (tanpa pengali), kosong kalau belum
 * dipetakan. Produk POS lain yang terjual di outlet itu (termasuk yang tidak
 * dipetakan) jadi baris tanpa menu.
 */
function perbandingan(outlet) {
  const baris = [];
  for (const o of Object.keys(CLOSING).sort()) {
    if (outlet && o !== outlet) continue;
    for (const [kode, sold, waste, adjustment, compensation] of CLOSING[o]) {
      const menu = state.closingMenus.find((x) => x.menu_code === kode);
      const products = menu.products
        .filter((p) => p.is_active)
        .map(({ product_id, product_name, multiplier }) => ({
          product_id,
          product_name,
          product_group: PRODUK_POS_INFO[product_id]?.product_group ?? null,
          multiplier,
          is_mapped: true,
        }));
      baris.push({
        outlet_code: o,
        production_date: TANGGAL_CLOSING,
        menu_id: menu.menu_id,
        menu_code: menu.menu_code,
        menu_name: menu.menu_name,
        sold,
        waste,
        adjustment,
        compensation,
        products,
        pos_qty: products.length
          ? products.reduce((n, p) => n + (QTY_POS[o][p.product_id] ?? 0), 0)
          : null,
      });
    }
    // Produk POS yang qty-nya belum tampil di baris menu mana pun.
    const tampil = new Set(
      baris
        .filter((b) => b.outlet_code === o)
        .flatMap((b) => b.products.map((p) => p.product_id)),
    );
    const terpetakan = new Map();
    for (const m of state.closingMenus) {
      for (const p of m.products.filter((p) => p.is_active)) {
        terpetakan.set(p.product_id, p.product_name);
      }
    }
    for (const [pid, qty] of Object.entries(QTY_POS[o])) {
      const product_id = Number(pid);
      if (!qty || tampil.has(product_id)) {
        continue;
      }
      baris.push({
        outlet_code: o,
        production_date: TANGGAL_CLOSING,
        menu_id: null,
        menu_code: null,
        menu_name: null,
        sold: null,
        waste: null,
        adjustment: null,
        compensation: null,
        products: [
          {
            product_id,
            product_name:
              terpetakan.get(product_id) ??
              PRODUK_POS_INFO[product_id]?.product_name ??
              null,
            product_group: PRODUK_POS_INFO[product_id]?.product_group ?? null,
            multiplier: 1,
            is_mapped: terpetakan.has(product_id),
          },
        ],
        pos_qty: qty,
      });
    }
  }
  return baris;
}

/**
 * Meniru `closing_export_service`: isi kiriman per outlet (satu tanggal
 * closing di data tiruan), blokir menu belum dipetakan / produk dobel.
 */
function rekapKirim(outlet) {
  const baris = perbandingan(outlet);
  const items = baris.map((b) => {
    const pos = b.pos_qty ?? 0;
    return {
      source: b.menu_id ? "closing" : "pos_only",
      menuId: b.menu_id,
      menuCode: b.menu_code,
      menuName: b.menu_name,
      productId: b.menu_id ? null : b.products[0].product_id,
      productName: b.menu_id ? null : b.products[0].product_name,
      colorplateSold: b.sold ?? 0,
      posQty: pos,
      totalSold: (b.sold ?? 0) + pos,
      waste: b.waste ?? 0,
      adjustment: b.adjustment ?? 0,
      compensation: b.compensation ?? 0,
    };
  });
  const menuBaris = baris.filter((b) => b.menu_id);
  const perProduk = new Map();
  for (const b of menuBaris) {
    for (const p of b.products) {
      perProduk.set(p.product_id, [
        ...(perProduk.get(p.product_id) ?? []),
        { nama: p.product_name, menu: b.menu_code },
      ]);
    }
  }
  return {
    items,
    hash: JSON.stringify(items),
    menu_belum_dipetakan: menuBaris
      .filter((b) => b.products.length === 0)
      .map((b) => ({
        menu_id: b.menu_id,
        menu_code: b.menu_code,
        menu_name: b.menu_name,
      })),
    produk_dobel: [...perProduk.entries()]
      .filter(([, daftar]) => daftar.length > 1)
      .map(([product_id, daftar]) => ({
        product_id,
        product_name: daftar[0].nama,
        menus: daftar.map((d) => d.menu).sort(),
      })),
  };
}

/** Salinan objek tanpa kunci tertentu. */
const tanpa = (obj, ...kunci) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => !kunci.includes(k)));
/** Ringkasan kiriman (tanpa payload) dan detailnya — `hash` hanya internal. */
const ringkasKiriman = (log) => tanpa(log, "payload", "response_body", "hash");
const detailKiriman = (log) => tanpa(log, "hash");

/** Sama dengan `normalize_product_group` di backend: hanya SPASI di ujung. */
const normalGroup = (v) =>
  String(v ?? "")
    .replace(/^ +| +$/g, "")
    .toUpperCase();

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
    path.startsWith("/api/product-groups") ||
    path.startsWith("/api/product-menus") ||
    path.startsWith("/api/closing-menus") ||
    path.startsWith("/api/closing-messages") ||
    path.startsWith("/api/closing-exports");
  if (butuhAdmin && user.role !== "admin") {
    return tolak(res, 403, "Akses ditolak");
  }
  if (
    (path === "/api/sales/by-outlet" ||
      path === "/api/outlets" ||
      path === "/api/brands") &&
    user.role === "outlet"
  ) {
    return tolak(res, 403, "Akses ditolak");
  }

  // Untuk role outlet, scope diambil dari identitas — `?outlet=` diabaikan.
  const outletScope =
    user.role === "outlet" ? user.outlet_code : url.searchParams.get("outlet");

  // ---- penjualan ----------------------------------------------------
  if (path === "/api/sales/summary") {
    const baris = SALES.filter(
      (s) => !outletScope || s.outlet_code === outletScope,
    );
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
        {
          sale_date: "2026-09-10",
          total_transactions: 4,
          total_amount: 600000,
        },
        {
          sale_date: "2026-09-11",
          total_transactions: 6,
          total_amount: 900000,
        },
        {
          sale_date: "2026-09-12",
          total_transactions: 5,
          total_amount: 750000,
        },
      ]),
    );
  }

  if (path === "/api/sales/by-outlet") {
    return json(
      res,
      200,
      bungkus([
        {
          outlet_code: "OUTLET_001",
          total_transactions: 60,
          total_amount: 9000000,
        },
        {
          outlet_code: "OUTLET_002",
          total_transactions: 60,
          total_amount: 8100000,
        },
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
          {
            loc: ["query", "product_group"],
            msg: "Field required",
            type: "missing",
          },
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
    const csv =
      "transaction_id,reference_no,receipt_pay_price\n1,REF-0001,150000\n";
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="transaksi_uji.csv"',
    });
    return res.end(csv);
  }

  if (path === "/api/sales/" || path === "/api/sales") {
    const semua = SALES.filter(
      (s) => !outletScope || s.outlet_code === outletScope,
    );
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

  // Belum ada brand — pemilih brand di filter tetap tersembunyi.
  if (path === "/api/brands" && method === "GET") {
    return json(res, 200, bungkus([]));
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
      bungkus(entri, {
        api_key: `mhr_baru_${kode}_rahasia`,
        message: "dibuat",
      }),
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
      bungkus(entri, {
        api_key: `mhr_rotasi_${kode}_rahasia`,
        message: "dirotasi",
      }),
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
          {
            loc: ["body", "email"],
            msg: "Email sudah dipakai",
            type: "value_error",
          },
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
          {
            loc: ["body", "is_active"],
            msg: "Field required",
            type: "missing",
          },
        ],
      });
    }
    target.is_active = body.is_active;
    target.updated_at = new Date().toISOString();
    return json(res, 200, bungkus(target));
  }

  // ---- closing report (Fase 11) -------------------------------------
  if (path === "/api/product-menus/candidates" && method === "GET") {
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const data = PRODUK_POS.filter(
      (p) =>
        !q ||
        p.product_name.toLowerCase().includes(q) ||
        String(p.product_id).includes(q),
    ).map((p) => ({
      ...p,
      outlet_codes: ["OUTLET_001", "OUTLET_002"],
      last_sale_date: TANGGAL_CLOSING,
    }));
    return json(res, 200, bungkus(data));
  }

  if (path === "/api/closing-menus" && method === "GET") {
    const status = url.searchParams.get("status") ?? "all";
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const data = state.closingMenus
      .map(menuTampil)
      .filter((m) => status !== "mapped" || m.is_mapped)
      .filter((m) => status !== "unmapped" || !m.is_mapped)
      .filter(
        (m) =>
          !q ||
          m.menu_code.toLowerCase().includes(q) ||
          m.menu_name.toLowerCase().includes(q),
      );
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const halaman = data.slice(offset, offset + limit);
    return json(res, 200, {
      ...bungkus(halaman),
      pagination: {
        limit,
        offset,
        total: data.length,
        has_more: offset + halaman.length < data.length,
      },
    });
  }

  const detailMenu = /^\/api\/closing-menus\/(\d+)$/.exec(path);
  if (detailMenu && method === "GET") {
    const menu = state.closingMenus.find((m) => m.id === Number(detailMenu[1]));
    if (!menu) return tolak(res, 404, "Menu closing tidak ditemukan");
    return json(res, 200, bungkus(menuTampil(menu)));
  }

  const tambahProduk = /^\/api\/closing-menus\/(\d+)\/products$/.exec(path);
  if (tambahProduk && method === "POST") {
    const menu = state.closingMenus.find(
      (m) => m.id === Number(tambahProduk[1]),
    );
    if (!menu) return tolak(res, 404, "Menu closing tidak ditemukan");
    const body = await bacaBody(req);
    const produk = PRODUK_POS.find((p) => p.product_id === body.product_id);
    if (!produk) {
      return tolak(
        res,
        422,
        `ProductID ${body.product_id} tidak ditemukan di data penjualan.`,
      );
    }
    if (menu.products.some((p) => p.product_id === body.product_id)) {
      return tolak(
        res,
        409,
        "ProductID sudah dipetakan ke menu ini. Ubah lewat PATCH.",
      );
    }
    const baru = {
      id:
        Math.max(
          0,
          ...state.closingMenus.flatMap((m) => m.products.map((p) => p.id)),
        ) + 1,
      product_id: produk.product_id,
      product_name: produk.product_name,
      multiplier: body.multiplier ?? 1,
      is_active: body.is_active !== false,
      created_at: new Date().toISOString().slice(0, 19),
      updated_at: null,
    };
    menu.products.push(baru);
    return json(res, 201, bungkus(baru));
  }

  const ubahProduk = /^\/api\/closing-menus\/(\d+)\/products\/(\d+)$/.exec(
    path,
  );
  if (ubahProduk && method === "PATCH") {
    const menu = state.closingMenus.find((m) => m.id === Number(ubahProduk[1]));
    const produk = menu?.products.find((p) => p.id === Number(ubahProduk[2]));
    if (!produk) return tolak(res, 404, "Mapping tidak ditemukan");
    const body = await bacaBody(req);
    if (body.multiplier !== undefined) produk.multiplier = body.multiplier;
    if (body.is_active !== undefined) produk.is_active = body.is_active;
    produk.updated_at = new Date().toISOString().slice(0, 19);
    return json(res, 200, bungkus(produk));
  }

  if (path === "/api/closing-reports/comparison" && method === "GET") {
    return json(res, 200, bungkus(perbandingan(outletScope)));
  }

  if (path === "/api/closing-reports" && method === "GET") {
    const data = Object.keys(CLOSING)
      .filter((o) => !outletScope || o === outletScope)
      .map(ringkasanClosing);
    return json(res, 200, {
      ...bungkus(data),
      pagination: { limit: 50, offset: 0, total: data.length, has_more: false },
    });
  }

  const detailClosing = /^\/api\/closing-reports\/([0-9a-f-]{36})$/.exec(path);
  if (detailClosing && method === "GET") {
    const outlet = Object.keys(CLOSING).find(
      (o) => closingReportId(o) === detailClosing[1],
    );
    // Laporan outlet lain = tidak ada, bukan 403 (sama dengan backend).
    if (!outlet || (outletScope && outlet !== outletScope)) {
      return tolak(res, 404, "Closing report tidak ditemukan");
    }
    const ringkas = ringkasanClosing(outlet);
    const items = CLOSING[outlet].map(
      ([kode, sold, waste, adjustment, compensation]) => {
        const menu = state.closingMenus.find((m) => m.menu_code === kode);
        return {
          menu_id: menu.menu_id,
          menu_code: kode,
          menu_name: menu.menu_name,
          production_date: TANGGAL_CLOSING,
          sold,
          waste,
          adjustment,
          compensation,
        };
      },
    );
    const revisions = [
      {
        id: 1,
        message_id: ringkas.closing_report_id,
        sent_at: ringkas.sent_at,
        received_at: ringkas.received_at,
        is_current: true,
        item_count: ringkas.item_count,
      },
    ];
    return json(res, 200, bungkus({ ...ringkas, items, revisions }));
  }

  // ---- kirim rekap closing ke API eksternal (backend Fase 8) ----------
  if (path === "/api/closing-exports/status" && method === "GET") {
    const outlet = url.searchParams.get("outlet");
    const data = Object.keys(CLOSING)
      .filter((o) => !outlet || o === outlet)
      .map((o) => {
        const rekap = rekapKirim(o);
        const riwayat = state.closingExports.filter((k) => k.outlet_code === o);
        const terakhir = riwayat.at(-1) ?? null;
        const sampai =
          riwayat.findLast((k) =>
            ["terkirim", "duplikat"].includes(k.status),
          ) ?? null;
        return {
          outlet_code: o,
          production_date: TANGGAL_CLOSING,
          status: !sampai
            ? "belum_dikirim"
            : sampai.hash === rekap.hash
              ? "terkirim"
              : "perlu_kirim_ulang",
          can_send:
            rekap.menu_belum_dipetakan.length === 0 &&
            rekap.produk_dobel.length === 0,
          item_count: rekap.items.length,
          total_sold: rekap.items.reduce((n, i) => n + i.totalSold, 0),
          menu_belum_dipetakan: rekap.menu_belum_dipetakan,
          produk_dobel: rekap.produk_dobel,
          last_attempt: terakhir && ringkasKiriman(terakhir),
          last_sent: sampai && ringkasKiriman(sampai),
        };
      });
    return json(res, 200, bungkus(data));
  }

  if (path === "/api/closing-exports" && method === "POST") {
    const body = await bacaBody(req);
    const outlet = body.outlet_code;
    if (!outlet || !body.production_date) {
      return tolak(res, 422, [
        { loc: ["body", "outlet_code"], msg: "Field required" },
      ]);
    }
    if (!CLOSING[outlet] || body.production_date !== TANGGAL_CLOSING) {
      return tolak(
        res,
        404,
        "Tidak ada closing untuk outlet dan tanggal produksi ini.",
      );
    }
    const rekap = rekapKirim(outlet);
    if (rekap.menu_belum_dipetakan.length || rekap.produk_dobel.length) {
      return tolak(res, 422, {
        message:
          "Rekap belum bisa dikirim: petakan semua menu dan pastikan satu ProductID hanya dipetakan ke satu menu.",
        menu_belum_dipetakan: rekap.menu_belum_dipetakan,
        produk_dobel: rekap.produk_dobel,
      });
    }
    const id = state.closingExports.length + 1;
    const sequence =
      state.closingExports.filter((k) => k.outlet_code === outlet).length + 1;
    const sekarang = new Date().toISOString().slice(0, 19);
    const messageId = `6f1c2a7e-3b4d-4e8f-9a10-${String(id).padStart(12, "0")}`;
    const log = {
      id,
      outlet_code: outlet,
      production_date: TANGGAL_CLOSING,
      sequence,
      message_id: messageId,
      status: "terkirim",
      attempts: 1,
      http_status: 201,
      error: null,
      item_count: rekap.items.length,
      sent_by: user.email,
      created_at: sekarang,
      started_at: sekarang,
      finished_at: sekarang,
      hash: rekap.hash,
      payload: {
        messageId,
        sentAt: `${sekarang}Z`,
        sequence,
        outlet: { code: outlet },
        productionDate: TANGGAL_CLOSING,
        items: rekap.items,
      },
      response_body: '{"received":true}',
    };
    state.closingExports.push(log);
    return json(res, 201, bungkus(detailKiriman(log)));
  }

  if (path === "/api/closing-exports" && method === "GET") {
    const outlet = url.searchParams.get("outlet");
    const data = state.closingExports
      .filter((k) => !outlet || k.outlet_code === outlet)
      .toReversed()
      .map(ringkasKiriman);
    return json(res, 200, {
      ...bungkus(data),
      pagination: { limit: 50, offset: 0, total: data.length, has_more: false },
    });
  }

  const kiriman = /^\/api\/closing-exports\/(\d+)(\/retry)?$/.exec(path);
  if (kiriman) {
    const log = state.closingExports.find((k) => k.id === Number(kiriman[1]));
    if (!log) return tolak(res, 404, "Kiriman tidak ditemukan");
    if (!kiriman[2] && method === "GET") {
      return json(res, 200, bungkus(detailKiriman(log)));
    }
    if (kiriman[2] && method === "POST") {
      return tolak(
        res,
        409,
        "Tidak bisa diulang: kiriman ini sudah sampai di API tujuan.",
      );
    }
  }

  if (path === "/api/closing-messages" && method === "GET") {
    const status = url.searchParams.get("status");
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const cocokCari = PESAN_CLOSING.filter(
      (p) =>
        !q ||
        (p.message_id ?? "").toLowerCase().includes(q) ||
        (p.outlet_code ?? "").toLowerCase().includes(q),
    );
    const counts = {
      baru: 0,
      revisi: 0,
      revisi_lama: 0,
      duplikat: 0,
      ditolak: 0,
    };
    for (const p of cocokCari) counts[p.status] += 1;
    const data = cocokCari
      .filter((p) => !status || p.status === status)
      // Daftar tanpa payload / error, sama dengan backend.
      .map((p) => {
        const ringkas = { ...p };
        delete ringkas.errors;
        delete ringkas.payload;
        delete ringkas.body_text;
        return ringkas;
      });
    return json(res, 200, {
      ...bungkus(data),
      pagination: { limit: 50, offset: 0, total: data.length, has_more: false },
      counts,
    });
  }

  const detailPesan = /^\/api\/closing-messages\/(\d+)$/.exec(path);
  if (detailPesan && method === "GET") {
    const pesan = PESAN_CLOSING.find((p) => p.id === Number(detailPesan[1]));
    if (!pesan) return tolak(res, 404, "Pesan tidak ditemukan");
    return json(res, 200, bungkus(pesan));
  }

  return tolak(res, 404, `Tidak ada rute ${method} ${path}`);
});

server.listen(PORT, () => {
  console.log(`mock-backend siap di http://127.0.0.1:${PORT}`);
});
