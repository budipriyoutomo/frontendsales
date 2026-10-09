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
    name,
    category: null,
    unit: null,
    price: 0,
    brand: null,
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

beforeEach(() => {
  toastError.mockClear();
  toastSuccess.mockClear();
  daftar = [
    produk(1, "P-001", "Red Plate", {
      category: "Plate",
      unit: "pcs",
      price: 25000,
      brand: { id: 1, code: "MHR", name: "Maharasa" },
      pos_mappings: [
        mapping(10, "OUT1", 101),
        mapping(11, "OUT2", 55, { is_active: false }),
      ],
    }),
    produk(2, "P-002", "Blue Plate", { is_active: false }),
  ];
  server.use(
    http.get("/api/products", () =>
      HttpResponse.json({ success: true, data: daftar }),
    ),
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
  it("menampilkan atribut, jumlah mapping aktif, dan status", async () => {
    renderWithQuery(<ProductsView />);

    const red = (await screen.findByText("Red Plate")).closest("tr")!;
    expect(within(red).getByText("Plate")).toBeInTheDocument();
    expect(within(red).getByText("MHR")).toBeInTheDocument();
    expect(within(red).getByText(/25\.000/)).toBeInTheDocument();
    // Mapping nonaktif tidak dihitung.
    expect(within(red).getByText("1 outlet")).toBeInTheDocument();
    expect(within(red).getByText("Aktif")).toBeInTheDocument();

    const blue = screen.getByText("Blue Plate").closest("tr")!;
    expect(within(blue).getByText("Belum dipetakan")).toBeInTheDocument();
    expect(within(blue).getByText("Nonaktif")).toBeInTheDocument();
  });

  it("pencarian menyaring di sisi klien", async () => {
    renderWithQuery(<ProductsView />);
    await screen.findByText("Red Plate");

    await userEvent.setup().type(screen.getByLabelText("Cari"), "blue");

    expect(screen.queryByText("Red Plate")).not.toBeInTheDocument();
    expect(screen.getByText("Blue Plate")).toBeInTheDocument();
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

describe("ProductsView — tambah produk", () => {
  it("mengirim input dengan pratinjau kode dan teks kosong sebagai null", async () => {
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
    await user.type(within(dialog).getByLabelText("Kode"), " p-003");
    expect(
      within(dialog).getByText(/akan tersimpan sebagai/i),
    ).toHaveTextContent("P-003");
    await user.type(within(dialog).getByLabelText("Nama produk"), "Baru");
    await user.type(within(dialog).getByLabelText("Harga (Rp)"), "15000");
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(body).toEqual({
        code: " p-003",
        name: "Baru",
        category: null,
        unit: null,
        brand_id: null,
        is_active: true,
        price: 15000,
      }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("validasi lokal mencegah request", async () => {
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
    await user.type(within(dialog).getByLabelText("Harga (Rp)"), "25.000");
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(within(dialog).getByText("Kode produk wajib diisi.")).toBeVisible();
    expect(within(dialog).getByText("Nama produk wajib diisi.")).toBeVisible();
    expect(within(dialog).getByText(/bilangan bulat/)).toBeVisible();
    expect(kirim).not.toHaveBeenCalled();
  });

  it("kode yang sudah ada (409) ditempel di field kode", async () => {
    server.use(
      http.post("/api/products", () =>
        HttpResponse.json({ detail: "sudah terdaftar" }, { status: 409 }),
      ),
    );

    renderWithQuery(<ProductsView />);
    const user = userEvent.setup();
    await screen.findByText("Red Plate");

    await user.click(screen.getByRole("button", { name: "Tambah produk" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Kode"), "P-001");
    await user.type(within(dialog).getByLabelText("Nama produk"), "Dobel");
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(
      await within(dialog).findByText(/sudah terdaftar/),
    ).toBeInTheDocument();
  });
});

describe("ProductsView — ubah produk", () => {
  it("tidak mengirim kode, dan harga hanya kalau diubah", async () => {
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
    expect(within(dialog).queryByLabelText("Kode")).not.toBeInTheDocument();

    const nama = within(dialog).getByLabelText("Nama produk");
    await user.clear(nama);
    await user.type(nama, "Red Plate Baru");
    await user.clear(within(dialog).getByLabelText("Kategori"));
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(body).toEqual({
        name: "Red Plate Baru",
        category: null,
        unit: "pcs",
        brand_id: 1,
        is_active: true,
      }),
    );
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
