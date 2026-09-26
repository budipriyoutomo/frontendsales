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

beforeEach(() => {
  toastError.mockClear();
  toastSuccess.mockClear();
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
    http.get("/api/product-menus", () =>
      HttpResponse.json({ success: true, data: terdaftar }),
    ),
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
      return HttpResponse.json({ success: true, data });
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

  it("menambah menu dengan mengirim product_id saja", async () => {
    let body: unknown;
    server.use(
      http.post("/api/product-menus", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          {
            success: true,
            data: {
              id: 2,
              product_id: 200300,
              product_name: "F birthday cake",
              product_group: "PROMO",
              is_active: true,
              created_at: "2026-09-16T08:00:00",
              updated_at: null,
            },
          },
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
});
