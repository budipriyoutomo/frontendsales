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

function kandidat(
  brand_code: string,
  pos_product_id: number,
  extra: Record<string, unknown> = {},
) {
  return {
    brand_id: brand_code === "MHR" ? 1 : 2,
    brand_code,
    brand_name: brand_code,
    pos_product_id,
    pos_product_name: "Red",
    pos_product_group: "COLORPLATE",
    pos_product_dept: "SUSHI",
    last_sale_date: "2026-01-15",
    outlet_codes: ["OUT1", "OUT2"],
    unmapped_outlet_codes: ["OUT1", "OUT2"],
    proposed_code: `${brand_code}-${pos_product_id}`,
    status: "baru",
    existing_product_id: null,
    reason: null,
    ...extra,
  };
}

const BRANDS = [
  {
    id: 1,
    code: "MHR",
    name: "Maharasa",
    is_active: true,
    outlet_codes: ["OUT1", "OUT2"],
    created_at: "2026-09-01T08:00:00",
    updated_at: null,
  },
  {
    id: 2,
    code: "XYZ",
    name: "Brand XYZ",
    is_active: true,
    outlet_codes: ["OUT3"],
    created_at: "2026-09-01T08:00:00",
    updated_at: null,
  },
];

let permintaan: URLSearchParams[];
let daftar: ReturnType<typeof kandidat>[];

beforeEach(() => {
  toastError.mockClear();
  toastSuccess.mockClear();
  permintaan = [];
  daftar = [
    kandidat("MHR", 101, { unmapped_outlet_codes: ["OUT2"] }),
    kandidat("MHR", 202, {
      pos_product_name: "Birthday Cake",
      status: "tambah_outlet",
      existing_product_id: 7,
    }),
    kandidat("XYZ", 101, {
      pos_product_name: "Red XYZ",
      status: "bentrok",
      reason: "Produk XYZ-101 sudah ada tetapi nonaktif",
    }),
  ];
  server.use(
    http.get("/api/products", () =>
      HttpResponse.json({ success: true, data: [] }),
    ),
    http.get("/api/brands", () =>
      HttpResponse.json({ success: true, data: BRANDS }),
    ),
    http.get("/api/products/import-candidates", ({ request }) => {
      permintaan.push(new URL(request.url).searchParams);
      return HttpResponse.json({ success: true, data: daftar });
    }),
  );
});

async function bukaDialog() {
  renderWithQuery(<ProductsView />);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Ambil dari transaksi" }),
  );
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByText("Birthday Cake");
  return { user, dialog };
}

describe("ProductImportDialog", () => {
  it("menampilkan kandidat per brand + ProductID dengan hasil yang akan dibuat", async () => {
    const { dialog } = await bukaDialog();

    const baru = within(dialog).getByText("MHR-101").closest("tr")!;
    expect(within(baru).getByText("Produk baru")).toBeVisible();
    expect(within(baru).getByText("OUT2")).toBeVisible();
    expect(
      within(baru).getByText("1 outlet lain sudah dipetakan"),
    ).toBeVisible();
    expect(within(baru).getByText("COLORPLATE / SUSHI")).toBeVisible();

    const tambah = within(dialog).getByText("MHR-202").closest("tr")!;
    expect(
      within(tambah).getByText("Tambah outlet ke produk yang sudah ada"),
    ).toBeVisible();

    const bentrok = within(dialog).getByText("XYZ-101").closest("tr")!;
    expect(
      within(bentrok).getByText(/Tidak bisa diimpor: Produk XYZ-101/),
    ).toBeVisible();
    expect(
      within(bentrok).getByRole("checkbox", { name: "Pilih XYZ-101" }),
    ).toBeDisabled();
  });

  it("pilih semua hanya memilih yang bisa diimpor, lalu mengirimnya", async () => {
    let body: unknown = null;
    server.use(
      http.post("/api/products/import", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          success: true,
          data: {
            created: 1,
            added: 1,
            skipped: 0,
            results: [],
          },
        });
      }),
    );
    const { user, dialog } = await bukaDialog();

    await user.click(
      within(dialog).getByRole("checkbox", {
        name: "Pilih semua yang bisa diimpor",
      }),
    );
    expect(within(dialog).getByText("2 dipilih")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Impor (2)" }));

    await waitFor(() =>
      expect(body).toEqual({
        items: [
          { brand_id: 1, pos_product_id: 101 },
          { brand_id: 1, pos_product_id: 202 },
        ],
      }),
    );
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        "1 produk dibuat, 1 ditambah outlet.",
      ),
    );
    expect(within(dialog).getByText("0 dipilih")).toBeVisible();
  });

  it("menampilkan alasan item yang dilewati", async () => {
    server.use(
      http.post("/api/products/import", () =>
        HttpResponse.json({
          success: true,
          data: {
            created: 0,
            added: 0,
            skipped: 1,
            results: [
              {
                brand_id: 1,
                pos_product_id: 101,
                status: "dilewati",
                product_id: null,
                code: null,
                mapped_outlets: [],
                reason: "Tidak ada outlet brand ini yang belum dipetakan",
              },
            ],
          },
        }),
      ),
    );
    const { user, dialog } = await bukaDialog();

    await user.click(
      within(dialog).getByRole("checkbox", { name: "Pilih MHR-101" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Impor (1)" }));

    expect(
      await within(dialog).findByText(
        /ProductID 101 — Tidak ada outlet brand ini yang belum dipetakan/,
      ),
    ).toBeVisible();
    expect(toastError).toHaveBeenCalledWith("Tidak ada produk yang diimpor.");
  });

  it("filter brand dan pencarian dikirim ke backend", async () => {
    const { user, dialog } = await bukaDialog();

    await user.type(within(dialog).getByLabelText("Cari produk POS"), "cake");
    await waitFor(() => expect(permintaan.at(-1)!.get("q")).toBe("cake"));

    await user.click(within(dialog).getByLabelText("Brand"));
    await user.click(
      await screen.findByRole("option", { name: "Brand XYZ (XYZ)" }),
    );
    await waitFor(() => expect(permintaan.at(-1)!.get("brand_id")).toBe("2"));
  });

  it("tombol impor nonaktif selama belum ada yang dipilih", async () => {
    const { dialog } = await bukaDialog();

    expect(
      within(dialog).getByRole("button", { name: "Impor (0)" }),
    ).toBeDisabled();
  });
});
