import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { ProductMenusView } from "@/components/admin/product-menus-view";

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}));

const kandidat = [
  {
    product_id: 200252,
    product_name: "Blue",
    product_group: "COLORPLATE",
    outlet_codes: ["STTSM", "STTBDG"],
    last_sale_date: "2026-09-01",
  },
  {
    product_id: 200300,
    product_name: "F birthday cake",
    product_group: "PROMO",
    outlet_codes: ["STTSM"],
    last_sale_date: "2026-09-01",
  },
  {
    product_id: 309747,
    product_name: "Chicken Katsu",
    product_group: "PROMO BANDUNG",
    outlet_codes: ["STTBDG"],
    last_sale_date: "2026-09-01",
  },
];

let terdaftar: Record<string, unknown>[];
let permintaanDaftar: URLSearchParams[];

beforeEach(() => {
  toastError.mockClear();
  toastSuccess.mockClear();
  permintaanDaftar = [];
  terdaftar = [
    {
      id: 1,
      product_id: 309747,
      product_name: "Chicken Katsu",
      product_group: "PROMO BANDUNG",
      is_active: true,
      created_at: "2026-09-01T08:00:00",
      updated_at: null,
    },
  ];
  server.use(
    http.get("/api/product-menus", ({ request }) => {
      const params = new URL(request.url).searchParams;
      permintaanDaftar.push(params);
      const limit = Number(params.get("limit") ?? 50);
      const offset = Number(params.get("offset") ?? 0);
      const data = terdaftar.slice(offset, offset + limit);
      return HttpResponse.json({
        success: true,
        data,
        pagination: {
          limit,
          offset,
          total: terdaftar.length,
          has_more: offset + data.length < terdaftar.length,
        },
      });
    }),
    http.get("/api/product-menus/candidates", ({ request }) => {
      const params = new URL(request.url).searchParams;
      const q = params.get("q");
      const outlet = params.get("outlet");
      let data = kandidat;
      if (q) {
        data = data.filter((k) => k.product_name.toLowerCase().includes(q));
      }
      if (outlet) {
        data = data.filter((k) => k.outlet_codes.includes(outlet));
      }
      // Server menandai kandidat yang sudah terdaftar lewat `mapping_id`.
      const idMapping = new Map(terdaftar.map((m) => [m.product_id, m.id]));
      return HttpResponse.json({
        success: true,
        data: data.map((k) => ({
          ...k,
          mapping_id: idMapping.get(k.product_id) ?? null,
        })),
      });
    }),
    http.get("/api/outlets", () =>
      HttpResponse.json({
        success: true,
        data: [
          { outlet_code: "STTBDG", is_active: true },
          { outlet_code: "STTSM", is_active: true },
        ],
      }),
    ),
    http.get("/api/product-groups", () =>
      HttpResponse.json({
        success: true,
        data: [
          {
            id: 1,
            product_group: "COLORPLATE",
            is_active: true,
            created_at: "2026-09-01T08:00:00",
            updated_at: null,
          },
        ],
      }),
    ),
    http.get("/api/product-menus/platecolors", () =>
      HttpResponse.json({ success: true, data: ["BLUE", "RED"] }),
    ),
    http.get("/api/product-menus/:id", ({ params }) => {
      const m = terdaftar.find((x) => x.id === Number(params.id));
      return m
        ? HttpResponse.json({ success: true, data: m })
        : HttpResponse.json({ detail: "tidak ada" }, { status: 404 });
    }),
    http.get("/api/sales/product-groups", () =>
      HttpResponse.json({
        success: true,
        data: ["COLORPLATE", "PROMO", "PROMO BANDUNG"],
      }),
    ),
  );
});

describe("ProductMenusView — mapping per menu", () => {
  it("menandai menu yang sudah terdaftar atau sudah ikut lewat group aktif", async () => {
    renderWithQuery(<ProductMenusView />);

    const promo = (await screen.findByText("F birthday cake")).closest("tr")!;
    expect(
      within(promo).getByRole("button", { name: "Tambahkan" }),
    ).toBeInTheDocument();

    const blue = screen.getByText("Blue").closest("tr")!;
    await waitFor(() =>
      expect(within(blue).getByText("Sudah ikut lewat group")).toBeVisible(),
    );

    const rows = await screen.findAllByText("Chicken Katsu");
    expect(
      rows.some((el) => within(el.closest("tr")!).queryByText("Terdaftar")),
    ).toBe(true);
  });

  it("menampilkan outlet tempat menu terjual", async () => {
    renderWithQuery(<ProductMenusView />);

    const blue = (await screen.findByText("Blue")).closest("tr")!;
    expect(within(blue).getByText("STTSM, STTBDG")).toBeVisible();
  });

  it("filter outlet mempersempit daftar kandidat", async () => {
    renderWithQuery(<ProductMenusView />);
    await screen.findByText("F birthday cake");

    await userEvent.click(screen.getByRole("combobox", { name: /outlet/i }));
    await userEvent.click(
      await screen.findByRole("option", { name: "STTBDG" }),
    );

    // "F birthday cake" hanya terjual di STTSM, jadi hilang dari kandidat.
    await waitFor(() =>
      expect(screen.queryByText("F birthday cake")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Blue")).toBeVisible();
  });

  it("menambah menu dengan mengirim product_id saja, lalu membuka dialog warnanya", async () => {
    let body: unknown;
    server.use(
      http.post("/api/product-menus", async ({ request }) => {
        body = await request.json();
        const baru = {
          id: 2,
          product_id: 200300,
          product_name: "F birthday cake",
          product_group: "PROMO",
          is_active: true,
          created_at: "2026-09-16T08:00:00",
          updated_at: null,
        };
        terdaftar.push(baru);
        return HttpResponse.json(
          { success: true, data: baru },
          { status: 201 },
        );
      }),
    );
    renderWithQuery(<ProductMenusView />);

    const promo = (await screen.findByText("F birthday cake")).closest("tr")!;
    await userEvent.click(
      within(promo).getByRole("button", { name: "Tambahkan" }),
    );

    await waitFor(() => expect(body).toEqual({ product_id: 200300 }));
    expect(toastSuccess).toHaveBeenCalled();
    // Dialog diisi dari detail, bukan dari halaman daftar yang termuat.
    expect(await screen.findByRole("dialog")).toBeVisible();
    // Kandidat dimuat ulang, jadi penandanya ikut berubah.
    await waitFor(() => {
      const baris = screen
        .getAllByText("F birthday cake")
        .map((el) => el.closest("tr")!)
        .find((tr) => within(tr).queryByText("PROMO"));
      expect(within(baris!).getByText("Terdaftar")).toBeInTheDocument();
    });
  });

  it("daftar menu terdaftar dipaginasi", async () => {
    terdaftar = Array.from({ length: 51 }, (_, i) => ({
      id: i + 1,
      product_id: 400000 + i,
      product_name: `Menu ${i + 1}`,
      product_group: "PROMO",
      is_active: true,
      created_at: "2026-09-01T08:00:00",
      updated_at: null,
    }));
    renderWithQuery(<ProductMenusView />);
    const user = userEvent.setup();

    await screen.findByText("Menu 1");
    expect(screen.getByText(/Halaman 1 dari 2 · 51 menu/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Berikutnya" }));
    expect(await screen.findByText("Menu 51")).toBeVisible();
    expect(permintaanDaftar.at(-1)!.get("offset")).toBe("50");
  });

  it("409 tampil sebagai 'sudah terdaftar', bukan galat umum", async () => {
    server.use(
      http.post("/api/product-menus", () =>
        HttpResponse.json({ detail: "sudah terdaftar" }, { status: 409 }),
      ),
    );
    renderWithQuery(<ProductMenusView />);

    const promo = (await screen.findByText("F birthday cake")).closest("tr")!;
    await userEvent.click(
      within(promo).getByRole("button", { name: "Tambahkan" }),
    );

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Menu ini sudah terdaftar",
        expect.anything(),
      ),
    );
  });

  it("menonaktifkan lewat dialog konfirmasi", async () => {
    let patch: unknown;
    server.use(
      http.patch("/api/product-menus/1", async ({ request }) => {
        patch = await request.json();
        return HttpResponse.json({
          success: true,
          data: { ...terdaftar[0], is_active: false },
        });
      }),
    );
    renderWithQuery(<ProductMenusView />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Nonaktifkan" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Nonaktifkan menu" }),
    );

    await waitFor(() => expect(patch).toEqual({ is_active: false }));
  });

  it("menu tanpa warna aktif ditandai tidak dipublish", async () => {
    renderWithQuery(<ProductMenusView />);

    expect(
      await screen.findByText("Belum ada — tidak dipublish"),
    ).toBeVisible();
  });

  it("menampilkan ringkasan warna aktif saja", async () => {
    terdaftar[0].colorplates = [
      { id: 1, platecolor: "RED", multiplier: 2, is_active: true },
      { id: 2, platecolor: "BLUE", multiplier: 1, is_active: false },
    ];
    renderWithQuery(<ProductMenusView />);

    expect(await screen.findByText("RED × 2")).toBeVisible();
    expect(screen.queryByText(/BLUE × 1/)).not.toBeInTheDocument();
  });

  it("menambah warna lewat dialog Atur warna", async () => {
    let body: unknown;
    server.use(
      http.post("/api/product-menus/1/colorplates", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          {
            success: true,
            data: { id: 5, platecolor: "RED", multiplier: 2, is_active: true },
          },
          { status: 201 },
        );
      }),
    );
    renderWithQuery(<ProductMenusView />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Atur warna" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("combobox", { name: "Warna" }),
    );
    await userEvent.click(await screen.findByRole("option", { name: "RED" }));
    const pengali = within(dialog).getByLabelText("Pengali");
    await userEvent.clear(pengali);
    await userEvent.type(pengali, "2");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Tambah warna" }),
    );

    await waitFor(() =>
      expect(body).toEqual({ platecolor: "RED", multiplier: 2 }),
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("warna yang sudah dipakai tidak muncul lagi di pilihan", async () => {
    terdaftar[0].colorplates = [
      { id: 1, platecolor: "RED", multiplier: 2, is_active: false },
    ];
    renderWithQuery(<ProductMenusView />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Atur warna" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("combobox", { name: "Warna" }),
    );

    expect(await screen.findByRole("option", { name: "BLUE" })).toBeVisible();
    expect(
      screen.queryByRole("option", { name: "RED" }),
    ).not.toBeInTheDocument();
  });

  it("mengubah pengali lewat PATCH", async () => {
    let patch: unknown;
    terdaftar[0].colorplates = [
      { id: 7, platecolor: "RED", multiplier: 2, is_active: true },
    ];
    server.use(
      http.patch("/api/product-menus/1/colorplates/7", async ({ request }) => {
        patch = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: 7, platecolor: "RED", multiplier: 3, is_active: true },
        });
      }),
    );
    renderWithQuery(<ProductMenusView />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Atur warna" }),
    );
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText("Pengali RED");
    await userEvent.clear(input);
    await userEvent.type(input, "3");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Simpan" }),
    );

    await waitFor(() => expect(patch).toEqual({ multiplier: 3 }));
  });
});
