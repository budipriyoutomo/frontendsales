import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import type { Filter } from "@/lib/filter";

const FILTER: Filter = { start_date: "2026-08-14", end_date: "2026-09-12" };

function summaryHandler(
  data: Record<string, number>,
  perekam?: (url: string) => void,
) {
  return http.get("/api/sales/summary", ({ request }) => {
    perekam?.(request.url);
    return HttpResponse.json({ success: true, data });
  });
}

describe("SummaryCards — angka dari API terformat id-ID (4.9)", () => {
  it("menampilkan omzet, transaksi, diskon, dan rata-rata", async () => {
    server.use(
      summaryHandler({
        total_transactions: 14,
        total_amount: 4418375,
        total_discount: 12500,
        average_per_transaction: 315598,
      }),
    );

    renderWithQuery(<SummaryCards filter={FILTER} />);

    expect(await screen.findByText("Rp 4.418.375")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("Rp 12.500")).toBeInTheDocument();
    expect(screen.getByText("Rp 315.598")).toBeInTheDocument();
  });

  it("mengirim rentang tanggal sebagai query param (4.10)", async () => {
    let url = "";
    server.use(
      summaryHandler(
        {
          total_transactions: 2,
          total_amount: 9900,
          total_discount: 0,
          average_per_transaction: 4950,
        },
        (u) => {
          url = u;
        },
      ),
    );

    renderWithQuery(
      <SummaryCards
        filter={{
          start_date: "2026-03-01",
          end_date: "2026-03-31",
          outlet: "OUT1",
        }}
      />,
    );

    await screen.findByText("Rp 9.900");
    const q = new URL(url).searchParams;
    expect(q.get("start_date")).toBe("2026-03-01");
    expect(q.get("end_date")).toBe("2026-03-31");
    expect(q.get("outlet")).toBe("OUT1");
  });
});

describe("SummaryCards — data kosong (4.11)", () => {
  it("tidak menampilkan Rp 0 yang menyesatkan saat belum ada transaksi", async () => {
    server.use(
      summaryHandler({
        total_transactions: 0,
        total_amount: 0,
        total_discount: 0,
        average_per_transaction: 0,
      }),
    );

    renderWithQuery(<SummaryCards filter={FILTER} />);

    expect(
      await screen.findAllByText(/belum ada transaksi pada rentang ini/i),
    ).toHaveLength(4);
    expect(screen.queryByText("Rp 0")).not.toBeInTheDocument();
  });

  it("tidak pernah menampilkan NaN saat field tidak lengkap", async () => {
    server.use(summaryHandler({ total_transactions: 3 }));

    renderWithQuery(<SummaryCards filter={FILTER} />);

    await screen.findByText("3");
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});

describe("SummaryCards — error API (4.12)", () => {
  it("menampilkan pesan dan tombol coba lagi yang benar-benar memuat ulang", async () => {
    let panggilan = 0;
    server.use(
      http.get("/api/sales/summary", () => {
        panggilan += 1;
        if (panggilan === 1) {
          return HttpResponse.json(
            { detail: "Terjadi kesalahan di server." },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          success: true,
          data: {
            total_transactions: 2,
            total_amount: 5000,
            total_discount: 0,
            average_per_transaction: 2500,
          },
        });
      }),
    );

    renderWithQuery(<SummaryCards filter={FILTER} />);

    const galat = await screen.findByRole("alert");
    expect(galat).toHaveTextContent(/terjadi kesalahan di server/i);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /coba lagi/i }));

    await waitFor(() =>
      expect(screen.getByText("Rp 5.000")).toBeInTheDocument(),
    );
  });

  it("tidak menawarkan coba lagi untuk 403 — mengulang tidak akan menolong", async () => {
    server.use(
      http.get("/api/sales/summary", () =>
        HttpResponse.json({ detail: "Akses ditolak" }, { status: 403 }),
      ),
    );

    renderWithQuery(<SummaryCards filter={FILTER} />);

    await screen.findByRole("alert");
    expect(
      screen.queryByRole("button", { name: /coba lagi/i }),
    ).not.toBeInTheDocument();
  });
});
