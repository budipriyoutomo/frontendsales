import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { PaymentSummary } from "@/components/dashboard/payment-summary";
import type { Filter } from "@/lib/filter";

const FILTER: Filter = { start_date: "2026-09-01", end_date: "2026-09-12" };

function baris(
  outlet: string,
  id: number,
  nama: string,
  trx: number,
  jumlah: number,
) {
  return {
    outlet_code: outlet,
    pay_type_id: id,
    pay_type_name: nama,
    total_transactions: trx,
    total_amount: jumlah,
  };
}

function handler(data: unknown, perekam?: (url: string) => void) {
  return http.get("/api/sales/payments", ({ request }) => {
    perekam?.(request.url);
    return HttpResponse.json({ success: true, data });
  });
}

describe("PaymentSummary", () => {
  it("menampilkan jumlah per jenis bayar dan totalnya", async () => {
    server.use(
      handler({
        rows: [
          baris("OUT1", 1, "Cash", 2, 150000),
          baris("OUT1", 5, "QRIS", 1, 50000),
        ],
        total_amount: 200000,
        transactions_without_payments: 0,
      }),
    );

    renderWithQuery(<PaymentSummary filter={FILTER} />);

    expect(await screen.findByText("Cash")).toBeInTheDocument();
    expect(screen.getByText("QRIS")).toBeInTheDocument();
    expect(screen.getByText("Rp 200.000")).toBeInTheDocument();
    // Satu outlet → kolom outlet tidak perlu.
    expect(
      screen.queryByRole("columnheader", { name: "Outlet" }),
    ).not.toBeInTheDocument();
  });

  it("menampilkan kolom outlet bila lebih dari satu outlet", async () => {
    server.use(
      handler({
        rows: [
          baris("OUT1", 1, "Cash", 1, 100),
          baris("OUT2", 1, "Tunai", 1, 200),
        ],
        total_amount: 300,
        transactions_without_payments: 0,
      }),
    );

    renderWithQuery(<PaymentSummary filter={FILTER} />);

    const tabel = await screen.findByRole("table");
    expect(
      within(tabel).getByRole("columnheader", { name: "Outlet" }),
    ).toBeInTheDocument();
    expect(within(tabel).getByText("OUT2")).toBeInTheDocument();
  });

  it("memberi catatan transaksi yang belum punya data pembayaran", async () => {
    server.use(
      handler({ rows: [], total_amount: 0, transactions_without_payments: 3 }),
    );

    renderWithQuery(<PaymentSummary filter={FILTER} />);

    expect(await screen.findByRole("note")).toHaveTextContent(
      /3 transaksi belum punya data pembayaran/,
    );
  });

  it("mengirim filter sebagai query param", async () => {
    let url = "";
    server.use(
      handler(
        { rows: [], total_amount: 0, transactions_without_payments: 0 },
        (u) => {
          url = u;
        },
      ),
    );

    renderWithQuery(<PaymentSummary filter={{ ...FILTER, outlet: "OUT1" }} />);

    expect(await screen.findByText("Belum ada pembayaran")).toBeInTheDocument();
    const q = new URL(url).searchParams;
    expect(q.get("start_date")).toBe("2026-09-01");
    expect(q.get("outlet")).toBe("OUT1");
  });
});
