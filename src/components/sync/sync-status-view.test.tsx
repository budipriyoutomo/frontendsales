import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { SyncStatusView } from "@/components/sync/sync-status-view";

function jamLalu(n: number): string {
  return new Date(Date.now() - n * 3600_000).toISOString();
}

function handler(rows: Record<string, unknown>[]) {
  return http.get("/api/outlets/sync-status", () =>
    HttpResponse.json({ success: true, data: rows }),
  );
}

describe("SyncStatusView — outlet basi ditandai (7.4)", () => {
  it("menandai outlet yang sudah lama tidak sync", async () => {
    server.use(
      handler([
        {
          outlet_code: "OUT_AKTIF",
          last_synced_at: jamLalu(1),
          last_sale_date: "2026-09-12",
          total_transactions: 20,
        },
        {
          outlet_code: "OUT_MATI",
          last_synced_at: jamLalu(48),
          last_sale_date: "2026-09-10",
          total_transactions: 5,
        },
      ]),
    );

    renderWithQuery(<SyncStatusView />);

    const barisMati = (await screen.findByText("OUT_MATI")).closest("tr")!;
    expect(
      within(barisMati).getByText(/tidak mengirim data/i),
    ).toBeInTheDocument();

    const barisAktif = screen.getByText("OUT_AKTIF").closest("tr")!;
    expect(within(barisAktif).getByText(/normal/i)).toBeInTheDocument();
  });

  it("menaruh outlet bermasalah di urutan atas", async () => {
    server.use(
      handler([
        {
          outlet_code: "OUT_AKTIF",
          last_synced_at: jamLalu(1),
          last_sale_date: "2026-09-12",
          total_transactions: 20,
        },
        {
          outlet_code: "OUT_MATI",
          last_synced_at: jamLalu(48),
          last_sale_date: "2026-09-10",
          total_transactions: 5,
        },
      ]),
    );

    renderWithQuery(<SyncStatusView />);
    await screen.findByText("OUT_MATI");

    const teks = document.body.textContent ?? "";
    expect(teks.indexOf("OUT_MATI")).toBeLessThan(teks.indexOf("OUT_AKTIF"));
  });
});

describe("SyncStatusView — outlet yang belum pernah sync (7.5)", () => {
  it("tidak merender tanggal kosong", async () => {
    server.use(
      handler([
        {
          outlet_code: "OUT_BARU",
          last_synced_at: null,
          last_sale_date: null,
          total_transactions: 0,
        },
      ]),
    );

    renderWithQuery(<SyncStatusView />);

    const baris = (await screen.findByText("OUT_BARU")).closest("tr")!;
    expect(within(baris).getByText(/belum pernah sync/i)).toBeInTheDocument();
    expect(within(baris).getByText("Belum pernah")).toBeInTheDocument();
    // Tidak boleh muncul "Invalid Date" atau sel tanggal kosong melompong.
    expect(baris.textContent).not.toMatch(/Invalid Date|NaN/);
  });

  it("membedakan belum-pernah-sync dari outlet yang basi", async () => {
    server.use(
      handler([
        {
          outlet_code: "OUT_BARU",
          last_synced_at: null,
          last_sale_date: null,
          total_transactions: 0,
        },
      ]),
    );

    renderWithQuery(<SyncStatusView />);
    await screen.findByText("OUT_BARU");

    // Outlet baru bukan outlet bermasalah — jangan diberi label alarm.
    expect(screen.queryByText(/tidak mengirim data/i)).not.toBeInTheDocument();
  });
});

describe("SyncStatusView — keadaan kosong", () => {
  it("menampilkan pesan saat belum ada outlet sama sekali", async () => {
    server.use(handler([]));

    renderWithQuery(<SyncStatusView />);

    expect(await screen.findByText("Belum ada outlet")).toBeInTheDocument();
  });
});
