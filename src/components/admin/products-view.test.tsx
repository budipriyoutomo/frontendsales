import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { ProductsView } from "@/components/admin/products-view";

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}));

function mapping(
  id: number,
  outlet_code: string,
  pos_product_id: number,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    outlet_code,
    pos_product_id,
    pos_product_name: "Red",
    pos_product_group: "COLORPLATE",
    is_active: true,
    created_at: "2026-09-01T08:00:00",
    updated_at: null,
    ...extra,
  };
}

function produk(
  id: number,
  code: string,
  name: string,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    code,
    product_code: `SKU-${id}`,
    name,
    category: null,
    subcategory: null,
    brand: { id: 1, code: "MHR", name: "Maharasa" },
    is_active: true,
    pos_mappings: [],
    created_at: "2026-09-01T08:00:00",
    updated_at: null,
    ...extra,
  };
}

const BRANDS = [
  {
    id: 1,
    code: "MHR",
    name: "Maharasa",
    is_active: true,
    outlet_codes: [],
    created_at: "2026-09-01T08:00:00",
    updated_at: null,
  },
];

let daftar: ReturnType<typeof produk>[];
let permintaanDaftar: URLSearchParams[];

/** Tiruan pencarian server: kolom yang sama dengan `product_service.list_products`. */
function cocok(p: ReturnType<typeof produk>, kata: string) {
  const k = kata.toUpperCase();
  return [
    p.code,
    p.product_code,
    p.name,
    p.category,
    p.subcategory,
    p.brand?.code,
    p.brand?.name,
  ].some((v) => v?.toUpperCase().includes(k));
}

beforeEach(() => {
  toastError.mockClear();
  toastSuccess.mockClear();
  permintaanDaftar = [];
  daftar = [
    produk(1, "P-001", "Red Plate", {
      category: "Plate",
      subcategory: "Nigiri",
      pos_mappings: [
        mapping(10, "OUT1", 101),
        mapping(11, "OUT2", 55, { is_active: false }),
      ],
    }),
    produk(2, "P-002", "Blue Plate", { is_active: false }),
  ];
  server.use(
    http.get("/api/products", ({ request }) => {
      const params = new URL(request.url).searchParams;
      permintaanDaftar.push(params);
      const q = params.get("q") ?? "";
      const limit = Number(params.get("limit") ?? 50);
      const offset = Number(params.get("offset") ?? 0);
      const cocokSemua = q ? daftar.filter((p) => cocok(p, q)) : daftar;
      const data = cocokSemua.slice(offset, offset + limit);
      return HttpResponse.json({
        success: true,
        data,
        pagination: {
          limit,
          offset,
          total: cocokSemua.length,
          has_more: offset + data.length < cocokSemua.length,
        },
      });
    }),
    http.get("/api/products/:id", ({ params }) => {
      const p = daftar.find((d) => d.id === Number(params.id));
      return p
        ? HttpResponse.json({ success: true, data: p })
        : HttpResponse.json(
            { detail: "Produk tidak ditemukan" },
            { status: 404 },
          );
    }),
    http.get("/api/brands", () =>
      HttpResponse.json({ success: true, data: BRANDS }),
    ),
    http.get("/api/outlets", () =>
      HttpResponse.json({
        success: true,
        data: [
          { outlet_code: "OUT1", is_active: true },
          { outlet_code: "OUT2", is_active: true },
        ],
      }),
    ),
  );
});

describe("ProductsView — daftar", () => {
  it("kolom ProductID, Product Code, dan Subkategori; tanpa Satuan dan Harga", async () => {
    renderWithQuery(<ProductsView />);
    await screen.findByText("Red Plate");

    const judul = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(judul).toEqual([
      "ProductID",
      "Product Code",
      "Nama",
      "Kategori",
      "Subkategori",
      "Brand",
      "ProductID POS",
      "Status",
      "Aksi",
    ]);
  });

  it("menampilkan atribut, jumlah mapping aktif, dan status", async () => {
    renderWithQuery(<ProductsView />);

    const red = (await screen.findByText("Red Plate")).closest("tr")!;
    expect(within(red).getByText("P-001")).toBeInTheDocument();
    expect(within(red).getByText("SKU-1")).toBeInTheDocument();
    expect(within(red).getByText("Plate")).toBeInTheDocument();
    expect(within(red).getByText("Nigiri")).toBeInTheDocument();
    expect(within(red).getByText("MHR")).toBeInTheDocument();
    // Mapping nonaktif tidak dihitung.
    expect(within(red).getByText("1 outlet")).toBeInTheDocument();
    expect(within(red).getByText("Aktif")).toBeInTheDocument();

    const blue = screen.getByText("Blue Plate").closest("tr")!;
    expect(within(blue).getByText("Belum dipetakan")).toBeInTheDocument();
    expect(within(blue).getByText("Nonaktif")).toBeInTheDocument();
  });

  it("produk lama tanpa Product Code dan brand ditandai belum diisi", async () => {
    daftar = [
      produk(3, "LAMA", "Produk Lama", { product_code: null, brand: null }),
    ];
    renderWithQuery(<ProductsView />);

    const row = (await screen.findByText("Produk Lama")).closest("tr")!;
    expect(within(row).getAllByText("Belum diisi")).toHaveLength(2);
  });

  it("pencarian dikirim ke server", async () => {
    renderWithQuery(<ProductsView />);
    const user = userEvent.setup();
    await screen.findByText("Red Plate");

    await user.type(screen.getByLabelText("Cari"), "blue");

    await waitFor(() =>
      expect(screen.queryByText("Red Plate")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Blue Plate")).toBeInTheDocument();
    expect(permintaanDaftar.at(-1)!.get("q")).toBe("blue");
  });

  it("pencarian tanpa hasil", async () => {
    renderWithQuery(<ProductsView />);
    await screen.findByText("Red Plate");

    await userEvent.setup().type(screen.getByLabelText("Cari"), "zzz");

    expect(await screen.findByText("Tidak ada yang cocok")).toBeVisible();
  });

  it("berpindah halaman, lalu pencarian baru kembali ke halaman pertama", async () => {
    daftar = Array.from({ length: 51 }, (_, i) =>
      produk(i + 1, `P-${String(i + 1).padStart(3, "0")}`, `Produk ${i + 1}`),
    );
    renderWithQuery(<ProductsView />);
    const user = userEvent.setup();

    await screen.findByText("Produk 1");
    expect(screen.getByText(/Halaman 1 dari 2 · 51 produk/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Berikutnya" }));
    expect(await screen.findByText("Produk 51")).toBeVisible();
    expect(screen.queryByText("Produk 1")).not.toBeInTheDocument();
    expect(permintaanDaftar.at(-1)!.get("offset")).toBe("50");
    expect(screen.getByRole("button", { name: "Berikutnya" })).toBeDisabled();

    await user.type(screen.getByLabelText("Cari"), "produk");
    await waitFor(() =>
      expect(permintaanDaftar.at(-1)!.get("q")).toBe("produk"),
    );
    expect(permintaanDaftar.at(-1)!.get("offset")).toBe("0");
  });

  it("tidak menawarkan tombol hapus", async () => {
    renderWithQuery(<ProductsView />);
    await screen.findByText("Red Plate");

    expect(
      screen.queryByRole("button", { name: /hapus/i }),
    ).not.toBeInTheDocument();
  });

  it("menampilkan keadaan kosong", async () => {
    daftar = [];
    renderWithQuery(<ProductsView />);

    expect(await screen.findByText("Belum ada produk")).toBeInTheDocument();
  });
});

async function pilihBrand(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  nama: RegExp,
) {
  await user.click(within(dialog).getByLabelText(/^Brand/));
  await user.click(await screen.findByRole("option", { name: nama }));
}

describe("ProductsView — tambah produk", () => {
  it("mengirim field wajib dan opsional; teks opsional kosong sebagai null", async () => {
    let body: unknown = null;
    server.use(
      http.post("/api/products", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { success: true, data: produk(3, "P-003", "Baru") },
          { status: 201 },
        );
      }),
    );

    renderWithQuery(<ProductsView />);
    const user = userEvent.setup();
    await screen.findByText("Red Plate");

    await user.click(screen.getByRole("button", { name: "Tambah produk" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText(/Satuan/)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Harga/)).not.toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/^ProductID/), " p-003");
    expect(
      within(dialog).getAllByText(/akan tersimpan sebagai/i)[0],
    ).toHaveTextContent("P-003");
    await user.type(within(dialog).getByLabelText(/^Product Code/), "sku-3");
    await user.type(within(dialog).getByLabelText(/^Nama produk/), "Baru");
    await pilihBrand(user, dialog, /Maharasa \(MHR\)/);
    await user.type(within(dialog).getByLabelText("Subkategori"), "Sushi");
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(body).toEqual({
        code: " p-003",
        product_code: "sku-3",
        name: "Baru",
        brand_id: 1,
        category: null,
        subcategory: "Sushi",
        is_active: true,
      }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("validasi lokal: ProductID, Product Code, nama, dan brand wajib", async () => {
    const kirim = vi.fn();
    server.use(
      http.post("/api/products", () => {
        kirim();
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    renderWithQuery(<ProductsView />);
    const user = userEvent.setup();
    await screen.findByText("Red Plate");

    await user.click(screen.getByRole("button", { name: "Tambah produk" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(within(dialog).getByText("ProductID wajib diisi.")).toBeVisible();
    expect(within(dialog).getByText("Product Code wajib diisi.")).toBeVisible();
    expect(within(dialog).getByText("Nama produk wajib diisi.")).toBeVisible();
    expect(within(dialog).getByText("Brand wajib dipilih.")).toBeVisible();
    expect(kirim).not.toHaveBeenCalled();
  });

  it.each([
    ["Produk 'P-001' sudah terdaftar.", /ProductID ini sudah terdaftar/],
    [
      "Product Code 'SKU-1' sudah dipakai produk lain.",
      /Product Code ini sudah dipakai/,
    ],
  ])("409 %s ditempel di field yang tepat", async (detail, pesan) => {
    server.use(
      http.post("/api/products", () =>
        HttpResponse.json({ detail }, { status: 409 }),
      ),
    );

    renderWithQuery(<ProductsView />);
    const user = userEvent.setup();
    await screen.findByText("Red Plate");

    await user.click(screen.getByRole("button", { name: "Tambah produk" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/^ProductID/), "P-001");
    await user.type(within(dialog).getByLabelText(/^Product Code/), "SKU-1");
    await user.type(within(dialog).getByLabelText(/^Nama produk/), "Dobel");
    await pilihBrand(user, dialog, /Maharasa \(MHR\)/);
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(await within(dialog).findByText(pesan)).toBeInTheDocument();
  });
});

describe("ProductsView — ubah produk", () => {
  it("tidak mengirim ProductID; Product Code bisa diubah", async () => {
    let body: unknown = null;
    server.use(
      http.patch("/api/products/1", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ success: true, data: daftar[0] });
      }),
    );

    renderWithQuery(<ProductsView />);
    const user = userEvent.setup();
    await screen.findByText("Red Plate");

    await user.click(screen.getByRole("button", { name: "Ubah P-001" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).queryByLabelText(/^ProductID/),
    ).not.toBeInTheDocument();

    const kode = within(dialog).getByLabelText(/^Product Code/);
    await user.clear(kode);
    await user.type(kode, "SKU-BARU");
    const nama = within(dialog).getByLabelText(/^Nama produk/);
    await user.clear(nama);
    await user.type(nama, "Red Plate Baru");
    await user.clear(within(dialog).getByLabelText("Kategori"));
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(body).toEqual({
        product_code: "SKU-BARU",
        name: "Red Plate Baru",
        brand_id: 1,
        category: null,
        subcategory: "Nigiri",
        is_active: true,
      }),
    );
  });

  it("produk lama wajib dilengkapi Product Code dan brand sebelum disimpan", async () => {
    const kirim = vi.fn();
    daftar = [
      produk(3, "LAMA", "Produk Lama", { product_code: null, brand: null }),
    ];
    server.use(
      http.patch("/api/products/3", () => {
        kirim();
        return HttpResponse.json({ success: true, data: daftar[0] });
      }),
    );

    renderWithQuery(<ProductsView />);
    const user = userEvent.setup();
    await screen.findByText("Produk Lama");

    await user.click(screen.getByRole("button", { name: "Ubah LAMA" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(within(dialog).getByText("Product Code wajib diisi.")).toBeVisible();
    expect(within(dialog).getByText("Brand wajib dipilih.")).toBeVisible();
    expect(kirim).not.toHaveBeenCalled();
  });
});

describe("ProductsView — mapping POS", () => {
  it("menampilkan mapping dan menonaktifkannya", async () => {
    let body: unknown = null;
    server.use(
      http.patch("/api/products/1/pos-mappings/10", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ success: true, data: daftar[0] });
      }),
    );

    renderWithQuery(<ProductsView />);
    const user = userEvent.setup();
    await screen.findByText("Red Plate");

    await user.click(screen.getByRole("button", { name: "Mapping POS P-001" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/OUT2 · ProductID 55 .*nonaktif/),
    ).toBeInTheDocument();

    const baris = within(dialog)
      .getByText(/OUT1 · ProductID 101/)
      .closest("li")!;
    await user.click(
      within(baris).getByRole("button", { name: "Nonaktifkan" }),
    );

    await waitFor(() => expect(body).toEqual({ is_active: false }));
  });

  it("mencari kandidat dan memetakan yang belum aktif di produk lain", async () => {
    let query: URLSearchParams | null = null;
    let body: unknown = null;
    server.use(
      http.get("/api/products/pos-candidates", ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json({
          success: true,
          data: [
            {
              outlet_code: "OUT1",
              pos_product_id: 101,
              pos_product_name: "Red",
              pos_product_group: "COLORPLATE",
              last_sale_date: "2026-01-15",
              mapped_product_id: 1,
              mapped_product_code: "P-001",
            },
            {
              outlet_code: "OUT2",
              pos_product_id: 77,
              pos_product_name: "Merah",
              pos_product_group: "COLORPLATE",
              last_sale_date: "2026-01-12",
              mapped_product_id: 9,
              mapped_product_code: "P-009",
            },
            {
              outlet_code: "OUT3",
              pos_product_id: 88,
              pos_product_name: "Red Besar",
              pos_product_group: "COLORPLATE",
              last_sale_date: "2026-01-11",
              mapped_product_id: null,
              mapped_product_code: null,
            },
          ],
        });
      }),
      http.post("/api/products/1/pos-mappings", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { success: true, data: daftar[0] },
          { status: 201 },
        );
      }),
    );

    renderWithQuery(<ProductsView />);
    const user = userEvent.setup();
    await screen.findByText("Red Plate");

    await user.click(screen.getByRole("button", { name: "Mapping POS P-001" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Cari produk POS"), "red");

    const hasil = await within(dialog).findByRole("list", {
      name: "Hasil pencarian produk POS",
    });
    expect(query!.get("q")).toBe("red");
    expect(query!.has("outlet")).toBe(false);

    const sendiri = within(hasil).getByText("Red").closest("li")!;
    expect(within(sendiri).getByText("Sudah di produk ini")).toBeVisible();
    const lain = within(hasil).getByText("Merah").closest("li")!;
    expect(within(lain).getByText("P-009")).toBeVisible();
    expect(within(lain).queryByRole("button")).not.toBeInTheDocument();

    const bebas = within(hasil).getByText("Red Besar").closest("li")!;
    await user.click(within(bebas).getByRole("button", { name: "Petakan" }));

    await waitFor(() =>
      expect(body).toEqual({ outlet_code: "OUT3", pos_product_id: 88 }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });
});
