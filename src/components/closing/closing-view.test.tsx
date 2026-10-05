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

function menu(nama: string, lain = {}) {
  return {
    menu_id: `0a1b2c3d-4e5f-4a7b-8c9d-${nama.length.toString().padStart(12, "0")}`,
    menu_code: null,
    menu_name: nama,
    multiplier: 1,
    sold: 5,
    waste: 1,
    adjustment: 0,
    compensation: 0,
    ...lain,
  };
}

function baris(produk: string | null, status: string, lain = {}) {
  return {
    outlet_code: "STTSM",
    production_date: "2026-10-02",
    product_id: produk ? 900000 + produk.length : null,
    product_name: produk,
    menus: [],
    closing_qty: 5,
    pos_qty: 5,
    selisih: 0,
    status,
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
          baris("RED", "cocok", {
            menus: [
              menu("Salmon Nigiri", { menu_code: "SU-001" }),
              menu("Tuna Nigiri", { sold: 0, compensation: 0 }),
            ],
          }),
          baris("BLUE", "selisih", {
            menus: [
              menu("Ebi Nigiri", {
                sold: 25,
                adjustment: 1,
                compensation: 1,
                multiplier: 1,
              }),
            ],
            closing_qty: 27,
            pos_qty: 16,
            selisih: -11,
          }),
          baris(null, "belum_dipetakan", {
            menus: [menu("Menu Lama", { multiplier: null })],
            pos_qty: null,
            selisih: null,
          }),
          baris("GREEN", "tidak_ada_di_closing", {
            closing_qty: null,
            pos_qty: 4,
            selisih: null,
          }),
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
  it("menampilkan baris dengan status dan selisih bertanda", async () => {
    renderWithQuery(<ClosingView role="admin" />);

    const selisih = (await screen.findByText("BLUE")).closest("tr")!;
    expect(within(selisih).getByText("Selisih")).toBeInTheDocument();
    expect(within(selisih).getByText("−11")).toBeInTheDocument();

    const tidakAda = screen.getByText("GREEN").closest("tr")!;
    expect(within(tidakAda).getByText("Tidak ada di closing")).toBeVisible();
  });

  it("baris produk menampilkan menu-menunya dan total closing", async () => {
    renderWithQuery(<ClosingView role="admin" />);

    const red = (await screen.findByText("RED")).closest("tr")!;
    expect(within(red).getByText(/Salmon Nigiri/)).toBeVisible();
    expect(within(red).getByText(/Tuna Nigiri/)).toBeVisible();

    const blue = screen.getByText("BLUE").closest("tr")!;
    // Closing 27, POS 16 → selisih −11 (POS − closing).
    expect(within(blue).getByText("27")).toBeVisible();
    expect(within(blue).getByText("16")).toBeVisible();
    expect(
      screen.getByText(/qty POS − \(terjual \+ adjustment \+ kompensasi\)/i),
    ).toBeVisible();
  });

  it("menu belum dipetakan tampil dengan nama menunya", async () => {
    renderWithQuery(<ClosingView role="admin" />);

    const lama = (await screen.findByText("Menu Lama")).closest("tr")!;
    expect(within(lama).getByText("Belum dipetakan")).toBeVisible();
  });

  it("ringkasan per status bisa dipakai untuk menyaring", async () => {
    renderWithQuery(<ClosingView role="admin" />);
    const user = userEvent.setup();

    await screen.findByText("RED");
    await user.click(
      screen.getByRole("button", { name: /Belum dipetakan\s*1/ }),
    );

    expect(screen.getByText("Menu Lama")).toBeVisible();
    expect(screen.queryByText("RED")).toBeNull();
    expect(
      screen.getByRole("button", { name: /Belum dipetakan\s*1/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("saring 'perlu dicek' menyembunyikan baris yang cocok", async () => {
    renderWithQuery(<ClosingView role="admin" />);
    const user = userEvent.setup();

    await screen.findByText("RED");
    await user.click(screen.getByRole("button", { name: /Perlu dicek\s*3/ }));

    expect(screen.queryByText("RED")).toBeNull();
    expect(screen.getByText("BLUE")).toBeVisible();
  });

  it("tidak mengirim brand — endpoint closing tidak menerimanya", async () => {
    renderWithQuery(<ClosingView role="admin" />);

    await screen.findByText("RED");
    const params = permintaanComparison.at(-1)!;
    expect(params.get("brand")).toBeNull();
    expect(params.get("start_date")).toBe("2026-10-01");
    expect(params.get("include_deleted")).toBeNull();
  });

  it("switch void mengirim include_deleted", async () => {
    renderWithQuery(<ClosingView role="admin" />);
    const user = userEvent.setup();

    await screen.findByText("RED");
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

    await screen.findByText("RED");
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
