import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { TransaksiView } from "@/components/transaksi/transaksi-view";

const replace = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/transaksi",
  useSearchParams: () => searchParams,
}));

const unduh = vi.fn();
vi.mock("@/lib/download", async (asli) => ({
  ...(await asli<typeof import("@/lib/download")>()),
  unduhResponse: (...args: unknown[]) => unduh(...args),
}));

function sale(id: number, extra: Record<string, unknown> = {}) {
  return {
    transaction_id: id,
    outlet_code: "OUT1",
    shop_id: 1,
    receipt_id: id,
    reference_no: `REF-${id}`,
    sale_date: "2026-09-12",
    paid_time: "2026-09-12T10:00:00",
    receipt_total_amount: 3,
    receipt_pay_price: 150000,
    receipt_discount: 0,
    transaction_status_id: 2,
    void_staff_id: 0,
    deleted: 0,
    created_at: null,
    updated_at: null,
    ...extra,
  };
}

function daftar(
  rows: ReturnType<typeof sale>[],
  pagination: Record<string, unknown>,
  perekam?: (url: string) => void,
) {
  return http.get("/api/sales", ({ request }) => {
    perekam?.(request.url);
    return HttpResponse.json({ success: true, data: rows, pagination });
  });
}

beforeEach(() => {
  replace.mockClear();
  unduh.mockClear();
  searchParams = new URLSearchParams(
    "start_date=2026-09-01&end_date=2026-09-12",
  );
  server.use(
    http.get("/api/outlets", () =>
      HttpResponse.json({ success: true, data: [] }),
    ),
  );
});

describe("TransaksiView — tabel (5.1, 5.6)", () => {
  it("merender baris dari API", async () => {
    server.use(
      daftar([sale(1), sale(2)], {
        limit: 50,
        offset: 0,
        total: 2,
        has_more: false,
      }),
    );

    renderWithQuery(<TransaksiView role="admin" />);

    expect(await screen.findByText("REF-1")).toBeInTheDocument();
    expect(screen.getByText("REF-2")).toBeInTheDocument();
    expect(screen.getAllByText("Rp 150.000")).toHaveLength(2);
  });

  it("menandai transaksi void secara visual, bukan warna saja (5.5)", async () => {
    server.use(
      daftar([sale(1), sale(2, { deleted: 1 })], {
        limit: 50,
        offset: 0,
        total: 2,
        has_more: false,
      }),
    );

    renderWithQuery(<TransaksiView role="admin" />);

    await screen.findByText("REF-1");
    const badge = screen.getByText("Void");
    expect(badge).toBeInTheDocument();
    // Hanya satu baris yang void.
    expect(screen.getAllByText("Void")).toHaveLength(1);
  });
});

describe("TransaksiView — pagination (5.2, 5.7, 5.8)", () => {
  it("mengirim offset yang benar saat pindah halaman (5.7)", async () => {
    let url = "";
    server.use(
      daftar(
        [sale(1)],
        { limit: 50, offset: 0, total: 120, has_more: true },
        (u) => {
          url = u;
        },
      ),
    );

    renderWithQuery(<TransaksiView role="admin" />);
    await screen.findByText("REF-1");

    expect(new URL(url).searchParams.get("offset")).toBe("0");

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /berikutnya/i }));

    const terakhir = replace.mock.calls.at(-1)![0] as string;
    expect(terakhir).toContain("offset=50");
  });

  it("menonaktifkan tombol berikutnya saat has_more false (5.8)", async () => {
    server.use(
      daftar([sale(1)], {
        limit: 50,
        offset: 0,
        total: 1,
        has_more: false,
      }),
    );

    renderWithQuery(<TransaksiView role="admin" />);
    await screen.findByText("REF-1");

    expect(screen.getByRole("button", { name: /berikutnya/i })).toBeDisabled();
  });

  it("menonaktifkan tombol sebelumnya di halaman pertama", async () => {
    server.use(
      daftar([sale(1)], { limit: 50, offset: 0, total: 90, has_more: true }),
    );

    renderWithQuery(<TransaksiView role="admin" />);
    await screen.findByText("REF-1");

    expect(screen.getByRole("button", { name: /sebelumnya/i })).toBeDisabled();
  });

  it("menampilkan total dari response, bukan hitungan baris di layar", async () => {
    server.use(
      daftar([sale(1)], { limit: 50, offset: 0, total: 137, has_more: true }),
    );

    renderWithQuery(<TransaksiView role="admin" />);

    expect(await screen.findByText(/137 transaksi/)).toBeInTheDocument();
  });
});

describe("TransaksiView — export CSV (5.4, 5.9)", () => {
  it("memicu unduhan, bukan menampilkan CSV mentah di layar", async () => {
    server.use(
      daftar([sale(1)], { limit: 50, offset: 0, total: 1, has_more: false }),
      http.get("/api/sales/export", () =>
        HttpResponse.text("transaction_id,total\n1,150000", {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": 'attachment; filename="sales.csv"',
          },
        }),
      ),
    );

    renderWithQuery(<TransaksiView role="admin" />);
    await screen.findByText("REF-1");

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /ekspor csv/i }));

    await waitFor(() => expect(unduh).toHaveBeenCalledTimes(1));
    expect(document.body.textContent).not.toContain("transaction_id,total");
  });

  it("mengirim filter yang sedang aktif ke endpoint export", async () => {
    let url = "";
    server.use(
      daftar([sale(1)], { limit: 50, offset: 0, total: 1, has_more: false }),
      http.get("/api/sales/export", ({ request }) => {
        url = request.url;
        return HttpResponse.text("a,b", {
          headers: { "Content-Type": "text/csv" },
        });
      }),
    );

    renderWithQuery(<TransaksiView role="admin" />);
    await screen.findByText("REF-1");

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /ekspor csv/i }));

    await waitFor(() => expect(unduh).toHaveBeenCalled());
    const q = new URL(url).searchParams;
    expect(q.get("start_date")).toBe("2026-09-01");
    expect(q.get("end_date")).toBe("2026-09-12");
  });
});

describe("TransaksiView — detail (5.3)", () => {
  it("membuka dialog detail beserta itemnya", async () => {
    server.use(
      daftar([sale(1)], { limit: 50, offset: 0, total: 1, has_more: false }),
      http.get("/api/sales/1", () =>
        HttpResponse.json({
          success: true,
          data: {
            ...sale(1),
            items: [
              {
                order_detail_id: 10,
                transaction_id: 1,
                product_id: 5,
                product_group: "Minuman",
                product_dept: null,
                product_name: "Es Teh",
                qty: 2,
                price: 8000,
                retail_price: 8000,
                order_status_id: 1,
                void_staff_id: 0,
                comment: null,
              },
            ],
          },
        }),
      ),
    );

    renderWithQuery(<TransaksiView role="admin" />);
    await screen.findByText("REF-1");

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /detail/i }));

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Es Teh")).toBeInTheDocument();
    expect(within(dialog).getByText("Minuman")).toBeInTheDocument();
  });
});
