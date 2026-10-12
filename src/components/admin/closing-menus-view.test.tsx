import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { ClosingMenusView } from "@/components/admin/closing-menus-view";

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}));

type Produk = {
  id: number;
  product_id: number;
  product_name: string | null;
  multiplier: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

type Menu = {
  id: number;
  menu_code: string;
  menu_id: string;
  menu_name: string;
  is_mapped: boolean;
  products: Produk[];
  first_seen_at: string;
  last_seen_at: string;
};

function menu(
  id: number,
  menu_code: string,
  menu_name: string,
  products: Produk[] = [],
): Menu {
  return {
    id,
    menu_code,
    menu_id: `0a1b2c3d-4e5f-4a7b-8c9d-0e1f2a3b4c5${id}`,
    menu_name,
    is_mapped: products.some((p) => p.is_active),
    products,
    first_seen_at: "2026-10-02T15:15:00",
    last_seen_at: "2026-10-02T15:15:00",
  };
}

let menus: Menu[];
let permintaanDaftar: URLSearchParams[];
let kirimPost: { url: string; body: unknown }[];
let kirimPatch: { url: string; body: unknown }[];

beforeEach(() => {
  toastError.mockClear();
  toastSuccess.mockClear();
  permintaanDaftar = [];
  kirimPost = [];
  kirimPatch = [];
  menus = [
    menu(1, "SU-001", "Salmon Nigiri"),
    menu(2, "SU-002", "Tuna Nigiri", [
      {
        id: 10,
        product_id: 200104,
        product_name: "Salmon HR",
        multiplier: 1,
        is_active: true,
        created_at: "2026-10-02T15:15:00",
        updated_at: null,
      },
    ]),
  ];
  server.use(
    http.get("/api/closing-menus", ({ request }) => {
      const params = new URL(request.url).searchParams;
      permintaanDaftar.push(params);
      const status = params.get("status");
      const q = params.get("q")?.toLowerCase();
      let data = menus;
      if (status === "unmapped") data = data.filter((m) => !m.is_mapped);
      if (status === "mapped") data = data.filter((m) => m.is_mapped);
      if (q) data = data.filter((m) => m.menu_name.toLowerCase().includes(q));
      return HttpResponse.json({ success: true, data });
    }),
    http.get("/api/product-menus/candidates", ({ request }) => {
      const q = new URL(request.url).searchParams.get("q") ?? "";
      const semua = [
        {
          product_id: 200104,
          product_name: "Salmon HR",
          product_group: "FOOD",
          outlet_codes: ["STTSM"],
          last_sale_date: "2026-10-02",
        },
        {
          product_id: 200999,
          product_name: "Salmon Paket 2",
          product_group: "PROMO",
          outlet_codes: ["STTSM"],
          last_sale_date: "2026-10-02",
        },
      ];
      return HttpResponse.json({
        success: true,
        data: semua.filter((c) =>
          c.product_name.toLowerCase().includes(q.toLowerCase()),
        ),
      });
    }),
    http.post(
      "/api/closing-menus/:id/products",
      async ({ request, params }) => {
        const body = (await request.json()) as {
          product_id: number;
          multiplier: number;
        };
        kirimPost.push({
          url: `/api/closing-menus/${params.id}/products`,
          body,
        });
        const target = menus.find((m) => m.id === Number(params.id))!;
        const baru: Produk = {
          id: 99,
          product_id: body.product_id,
          product_name: "Salmon Paket 2",
          multiplier: body.multiplier,
          is_active: true,
          created_at: "2026-10-05T01:00:00",
          updated_at: null,
        };
        target.products = [...target.products, baru];
        target.is_mapped = true;
        return HttpResponse.json(
          { success: true, data: baru },
          { status: 201 },
        );
      },
    ),
    http.patch(
      "/api/closing-menus/:id/products/:pid",
      async ({ request, params }) => {
        const body = (await request.json()) as Partial<Produk>;
        kirimPatch.push({
          url: `/api/closing-menus/${params.id}/products/${params.pid}`,
          body,
        });
        const target = menus.find((m) => m.id === Number(params.id))!;
        const p = target.products.find((x) => x.id === Number(params.pid))!;
        Object.assign(p, body, { updated_at: "2026-10-05T01:00:00" });
        target.is_mapped = target.products.some((x) => x.is_active);
        return HttpResponse.json({ success: true, data: p });
      },
    ),
  );
});

describe("ClosingMenusView — daftar", () => {
  it("default menampilkan menu yang belum dipetakan", async () => {
    renderWithQuery(<ClosingMenusView />);

    expect(await screen.findByText("Salmon Nigiri")).toBeVisible();
    expect(screen.queryByText("Tuna Nigiri")).toBeNull();
    expect(permintaanDaftar.at(-1)!.get("status")).toBe("unmapped");
  });

  it("status semua menampilkan ringkasan mapping", async () => {
    renderWithQuery(<ClosingMenusView />);
    const user = userEvent.setup();

    await screen.findByText("Salmon Nigiri");
    await user.click(screen.getByRole("combobox", { name: /status/i }));
    await user.click(await screen.findByRole("option", { name: "Semua" }));

    const tuna = (await screen.findByText("Tuna Nigiri")).closest("tr")!;
    expect(within(tuna).getByText(/Salmon HR.*200104.*× 1/)).toBeVisible();
    const salmon = screen.getByText("Salmon Nigiri").closest("tr")!;
    expect(within(salmon).getByText(/belum dipetakan/i)).toBeVisible();
  });

  it("menu tanpa kode tampil dengan penanda, brand ikut terlihat", async () => {
    menus.push({
      ...menu(3, "X", "Menu Lama"),
      menu_code: null as unknown as string,
      brand_code: "MHR",
    } as Menu);
    renderWithQuery(<ClosingMenusView />);

    const row = (await screen.findByText("Menu Lama")).closest("tr")!;
    expect(within(row).getByText(/tanpa kode/i)).toBeVisible();
    expect(within(row).getByText(/MHR/)).toBeVisible();
  });

  it("penjelasan pengali memakai unit POS per porsi", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ClosingMenusView />);

    // Penjelasan lengkap ada di balik "Cara kerja" (tertutup secara default).
    await user.click(screen.getByText("Cara kerja"));

    expect(
      await screen.findByText(/berapa unit produk POS untuk 1 porsi menu/i),
    ).toBeVisible();
  });

  it("pencarian dikirim ke server", async () => {
    renderWithQuery(<ClosingMenusView />);
    const user = userEvent.setup();

    await screen.findByText("Salmon Nigiri");
    await user.type(screen.getByLabelText(/cari menu/i), "salmon");

    await waitFor(() =>
      expect(permintaanDaftar.at(-1)!.get("q")).toBe("salmon"),
    );
  });
});

describe("ClosingMenusView — atur mapping", () => {
  async function bukaDialog(nama: string, status = "unmapped") {
    const user = userEvent.setup();
    renderWithQuery(<ClosingMenusView />);
    if (status === "all") {
      await screen.findByText("Salmon Nigiri");
      await user.click(screen.getByRole("combobox", { name: /status/i }));
      await user.click(await screen.findByRole("option", { name: "Semua" }));
    }
    const row = (await screen.findByText(nama)).closest("tr")!;
    await user.click(
      within(row).getByRole("button", { name: /atur mapping/i }),
    );
    return { user, dialog: await screen.findByRole("dialog") };
  }

  it("menambah ProductID dengan pengali; dialog tetap terbuka walau menu jadi terpetakan", async () => {
    const { user, dialog } = await bukaDialog("Salmon Nigiri");

    await user.type(within(dialog).getByLabelText(/cari produk pos/i), "paket");
    const kandidat = (
      await within(dialog).findByText("Salmon Paket 2")
    ).closest("li")!;
    const pengali = within(kandidat).getByLabelText(/pengali/i);
    await user.clear(pengali);
    await user.type(pengali, "2");
    await user.click(
      within(kandidat).getByRole("button", { name: "Tambahkan" }),
    );

    await waitFor(() =>
      expect(kirimPost).toEqual([
        {
          url: "/api/closing-menus/1/products",
          body: { product_id: 200999, multiplier: 2 },
        },
      ]),
    );
    expect(toastSuccess).toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(
      await within(screen.getByRole("dialog")).findByText(/ProductID 200999/),
    ).toBeVisible();
  });

  it("409 dijelaskan, bukan pesan mentah", async () => {
    server.use(
      http.post("/api/closing-menus/:id/products", () =>
        HttpResponse.json({ detail: "sudah ada" }, { status: 409 }),
      ),
    );
    const { user, dialog } = await bukaDialog("Salmon Nigiri");

    await user.type(
      within(dialog).getByLabelText(/cari produk pos/i),
      "salmon",
    );
    const kandidat = (await within(dialog).findByText("Salmon HR")).closest(
      "li",
    )!;
    await user.click(
      within(kandidat).getByRole("button", { name: "Tambahkan" }),
    );

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "ProductID ini sudah dipetakan ke menu ini",
        expect.anything(),
      ),
    );
  });

  it("mengubah pengali dan menonaktifkan mapping yang ada", async () => {
    const { user, dialog } = await bukaDialog("Tuna Nigiri", "all");

    const baris = within(dialog)
      .getByText(/ProductID 200104/)
      .closest("li")!;
    const pengali = within(baris).getByLabelText(/pengali/i);
    await user.clear(pengali);
    await user.type(pengali, "3");
    await user.click(within(baris).getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(kirimPatch.at(-1)).toEqual({
        url: "/api/closing-menus/2/products/10",
        body: { multiplier: 3 },
      }),
    );

    await user.click(
      within(baris).getByRole("button", { name: "Nonaktifkan" }),
    );
    await waitFor(() =>
      expect(kirimPatch.at(-1)).toEqual({
        url: "/api/closing-menus/2/products/10",
        body: { is_active: false },
      }),
    );
  });

  it("pengali di luar 1–1000 tidak bisa disimpan", async () => {
    const { user, dialog } = await bukaDialog("Tuna Nigiri", "all");

    const baris = within(dialog)
      .getByText(/ProductID 200104/)
      .closest("li")!;
    const pengali = within(baris).getByLabelText(/pengali/i);
    await user.clear(pengali);
    await user.type(pengali, "0");

    expect(
      within(baris).getByRole("button", { name: "Simpan" }),
    ).toBeDisabled();
  });
});
