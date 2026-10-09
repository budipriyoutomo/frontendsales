import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { ClosingView } from "@/components/closing/closing-view";
import { formatTanggalWaktu } from "@/lib/format";

const replace = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/closing",
  useSearchParams: () => searchParams,
}));

const REPORT_ID = "6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b";

function baris(nama: string, lain = {}) {
  return {
    outlet_code: "STTSM",
    production_date: "2026-10-02",
    menu_id: `0a1b2c3d-4e5f-4a7b-8c9d-${nama.length.toString().padStart(12, "0")}`,
    menu_code: null,
    menu_name: nama,
    sold: 5,
    waste: 1,
    adjustment: 0,
    compensation: 0,
    products: [
      {
        product_id: 900001,
        product_name: "RED",
        multiplier: 1,
        is_mapped: true,
      },
    ],
    pos_qty: 5,
    ...lain,
  };
}

let permintaanComparison: URLSearchParams[];

beforeEach(() => {
  replace.mockClear();
  searchParams = new URLSearchParams(
    "start_date=2026-10-01&end_date=2026-10-05&brand=MHR",
  );
  permintaanComparison = [];
  server.use(
    http.get("/api/outlets", () =>
      HttpResponse.json({
        success: true,
        data: [{ outlet_code: "STTSM", is_active: true, brand_code: null }],
      }),
    ),
    http.get("/api/closing-reports/comparison", ({ request }) => {
      permintaanComparison.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        success: true,
        data: [
          baris("Salmon Nigiri", {
            menu_code: "SU-001",
            sold: 42,
            waste: 3,
            adjustment: -2,
            compensation: 7,
            pos_qty: 31,
          }),
          baris("Ebi Nigiri", {
            products: [
              {
                product_id: 900002,
                product_name: "BLUE",
                multiplier: 2,
                is_mapped: true,
              },
              {
                product_id: 900003,
                product_name: "BLUE PROMO",
                multiplier: 1,
                is_mapped: true,
              },
            ],
            pos_qty: 16,
          }),
          baris("Menu Lama", { products: [], pos_qty: null }),
          {
            outlet_code: "STTSM",
            production_date: "2026-10-02",
            menu_id: null,
            menu_code: null,
            menu_name: null,
            sold: null,
            waste: null,
            adjustment: null,
            compensation: null,
            products: [
              {
                product_id: 900009,
                product_name: "GREEN",
                multiplier: 1,
                is_mapped: true,
              },
            ],
            pos_qty: 4,
          },
          {
            outlet_code: "STTSM",
            production_date: "2026-10-02",
            menu_id: null,
            menu_code: null,
            menu_name: null,
            sold: null,
            waste: null,
            adjustment: null,
            compensation: null,
            products: [
              {
                product_id: 700001,
                product_name: "ES TEH",
                product_group: "MINUMAN",
                multiplier: 1,
                is_mapped: false,
              },
            ],
            pos_qty: 12,
          },
        ],
      });
    }),
    http.get("/api/closing-reports", () =>
      HttpResponse.json({
        success: true,
        data: [
          {
            closing_report_id: REPORT_ID,
            report_date: "2026-10-02",
            outlet_code: "STTSM",
            outlet_name: "Maharasa PIK",
            brand_code: "MHR",
            brand_name: "Maharasa",
            sent_at: "2026-10-02T15:15:00",
            received_at: "2026-10-02T15:15:02",
            revision_count: 2,
            item_count: 1,
          },
        ],
        pagination: { limit: 50, offset: 0, total: 1, has_more: false },
      }),
    ),
    http.get(`/api/closing-reports/${REPORT_ID}`, () =>
      HttpResponse.json({
        success: true,
        data: {
          closing_report_id: REPORT_ID,
          report_date: "2026-10-02",
          outlet_code: "STTSM",
          outlet_name: "Maharasa PIK",
          brand_code: "MHR",
          brand_name: "Maharasa",
          sent_at: "2026-10-02T16:00:00",
          received_at: "2026-10-02T16:00:01",
          revision_count: 2,
          item_count: 1,
          items: [
            {
              menu_id: "0a1b2c3d-4e5f-4a7b-8c9d-0e1f2a3b4c5d",
              menu_code: "SU-001",
              menu_name: "Salmon Nigiri",
              production_date: "2026-10-02",
              sold: 42,
              waste: 3,
              adjustment: -1,
              compensation: 2,
            },
          ],
          revisions: [
            {
              id: 2,
              message_id: "kiriman-2",
              sent_at: "2026-10-02T16:00:00",
              received_at: "2026-10-02T16:00:01",
              is_current: true,
              item_count: 1,
            },
            {
              id: 1,
              message_id: REPORT_ID,
              sent_at: "2026-10-02T15:15:00",
              received_at: "2026-10-02T15:15:02",
              is_current: false,
              item_count: 1,
            },
          ],
        },
      }),
    ),
  );
});

function urlTerakhir() {
  return new URLSearchParams(
    (replace.mock.calls.at(-1)![0] as string).split("?")[1],
  );
}

describe("ClosingView — perbandingan POS", () => {
  it("kolom dikelompokkan Colorplate dan POS", async () => {
    renderWithQuery(<ClosingView role="admin" />);

    await screen.findByText("Salmon Nigiri");
    for (const judul of [
      "Colorplate",
      "Terjual",
      "Waste",
      "Adjustment",
      "Kompensasi",
      "POS",
      "Produk",
      "Qty",
    ]) {
      expect(screen.getByRole("columnheader", { name: judul })).toBeVisible();
    }
    expect(
      screen.queryByRole("columnheader", { name: /selisih|status/i }),
    ).toBeNull();
  });

  it("satu baris per menu dengan angka Colorplate dan qty POS", async () => {
    renderWithQuery(<ClosingView role="admin" />);

    const row = (await screen.findByText("Salmon Nigiri")).closest("tr")!;
    expect(
      within(row)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual([
      expect.any(String),
      "STTSM",
      "Salmon NigiriSU-001",
      "42",
      "3",
      "−2",
      "7",
      "RED900001",
      "31",
    ]);
  });

  it("menu dengan beberapa produk POS menampilkan semuanya dan pengalinya", async () => {
    renderWithQuery(<ClosingView role="admin" />);

    const row = (await screen.findByText("Ebi Nigiri")).closest("tr")!;
    expect(within(row).getByText("BLUE")).toBeVisible();
    expect(within(row).getByText("BLUE PROMO")).toBeVisible();
    expect(within(row).getByText("900002 · × 2")).toBeVisible();
    expect(within(row).getByText("16")).toBeVisible();
  });

  it("menu belum dipetakan tampil tanpa qty POS", async () => {
    renderWithQuery(<ClosingView role="admin" />);

    const lama = (await screen.findByText("Menu Lama")).closest("tr")!;
    expect(within(lama).getByText("Belum dipetakan")).toBeVisible();
    expect(within(lama).getAllByRole("cell").at(-1)).toHaveTextContent("—");
  });

  it("produk POS tanpa menu di Colorplate tetap tampil untuk konsolidasi", async () => {
    renderWithQuery(<ClosingView role="manager" />);

    const row = (await screen.findByText("GREEN")).closest("tr")!;
    expect(
      within(row)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual([
      expect.any(String),
      "STTSM",
      "Tidak ada di Colorplate",
      "—",
      "—",
      "—",
      "—",
      "GREEN900009",
      "4",
    ]);
    expect(
      screen.getByText(/2 produk POS terjual tetapi tidak ada menunya/),
    ).toBeVisible();
  });

  it("transaksi POS bukan Colorplate ikut tampil dengan group-nya", async () => {
    renderWithQuery(<ClosingView role="manager" />);

    const row = (await screen.findByText("ES TEH")).closest("tr")!;
    expect(within(row).getByText("Tidak ada di Colorplate")).toBeVisible();
    expect(within(row).getByText("700001 · MINUMAN")).toBeVisible();
    expect(within(row).getByText("Belum dipetakan ke menu")).toBeVisible();
    expect(within(row).getAllByRole("cell").at(-1)).toHaveTextContent("12");

    const salmon = screen.getByText("Salmon Nigiri").closest("tr")!;
    expect(within(salmon).queryByText("Belum dipetakan ke menu")).toBeNull();
  });

  it("admin hanya diminta memetakan menu yang belum dipetakan", async () => {
    renderWithQuery(<ClosingView role="admin" />);

    expect(
      await screen.findByText(/1 menu belum punya angka POS/),
    ).toBeVisible();
  });

  it("tidak mengirim brand — endpoint closing tidak menerimanya", async () => {
    renderWithQuery(<ClosingView role="admin" />);

    await screen.findByText("Salmon Nigiri");
    const params = permintaanComparison.at(-1)!;
    expect(params.get("brand")).toBeNull();
    expect(params.get("start_date")).toBe("2026-10-01");
    expect(params.get("include_deleted")).toBeNull();
  });

  it("switch void mengirim include_deleted", async () => {
    renderWithQuery(<ClosingView role="admin" />);
    const user = userEvent.setup();

    await screen.findByText("Salmon Nigiri");
    await user.click(
      screen.getByRole("switch", { name: /ikutkan transaksi void/i }),
    );

    await waitFor(() =>
      expect(permintaanComparison.at(-1)!.get("include_deleted")).toBe("true"),
    );
  });

  it("admin diarahkan ke halaman mapping kalau ada menu belum dipetakan", async () => {
    renderWithQuery(<ClosingView role="admin" />);

    expect(
      await screen.findByRole("link", { name: /petakan menu/i }),
    ).toHaveAttribute("href", "/closing-menu");
  });

  it("non-admin tidak ditawari halaman mapping", async () => {
    renderWithQuery(<ClosingView role="manager" />);

    await screen.findByText("Salmon Nigiri");
    expect(screen.queryByRole("link", { name: /petakan menu/i })).toBeNull();
  });
});

describe("ClosingView — daftar laporan", () => {
  it("tab tersimpan di URL dan filter lain tidak hilang", async () => {
    renderWithQuery(<ClosingView role="admin" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: /daftar laporan/i }));

    expect(urlTerakhir().get("tab")).toBe("laporan");
    expect(urlTerakhir().get("start_date")).toBe("2026-10-01");
  });

  it("menampilkan laporan dan waktu kirim dibaca sebagai UTC", async () => {
    searchParams.set("tab", "laporan");
    renderWithQuery(<ClosingView role="admin" />);

    const row = (await screen.findByText("Maharasa PIK")).closest("tr")!;
    const wib = formatTanggalWaktu(new Date(Date.UTC(2026, 9, 2, 15, 15)));
    expect(within(row).getByText(wib)).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();
  });

  it("detail menampilkan item revisi aktif dan riwayat revisi", async () => {
    searchParams.set("tab", "laporan");
    renderWithQuery(<ClosingView role="admin" />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Detail" }));

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Salmon Nigiri")).toBeVisible();
    expect(within(dialog).getByText("−1")).toBeVisible();
    expect(within(dialog).getByText("kiriman-2")).toBeVisible();
    expect(within(dialog).getByText("Aktif")).toBeVisible();
  });
});
