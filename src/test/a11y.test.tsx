import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { LoginForm } from "@/components/auth/login-form";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { SyncStatusView } from "@/components/sync/sync-status-view";
import { AksesDitolak } from "@/components/auth/akses-ditolak";
import { ProductGroupsView } from "@/components/admin/product-groups-view";
import { GroupRecap } from "@/components/dashboard/group-recap";
import { ClosingView } from "@/components/closing/closing-view";
import { ClosingMenusView } from "@/components/admin/closing-menus-view";
import { ClosingMessagesView } from "@/components/admin/closing-messages-view";
import { ClosingExportPanel } from "@/components/closing/closing-export-panel";

/**
 * Cek aksesibilitas dasar (TODO 8.7).
 *
 * Dijalankan dengan axe-core sungguhan, bukan pemeriksaan manual: label
 * form yang hilang dan kontras yang kurang adalah hal yang paling mudah
 * rusak diam-diam saat markup diubah.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

async function periksa(container: HTMLElement) {
  const hasil = await axe.run(container, {
    // Aturan yang butuh seluruh dokumen (landmark, heading tunggal) tidak
    // bermakna saat komponen dirender sendirian.
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa"],
    },
    rules: {
      region: { enabled: false },
    },
  });

  return hasil.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.length} elemen)`,
  );
}

beforeEach(() => {
  server.use(
    http.get("/api/outlets/sync-status", () =>
      HttpResponse.json({
        success: true,
        data: [
          {
            outlet_code: "OUT1",
            last_synced_at: new Date().toISOString(),
            last_sale_date: "2026-09-12",
            total_transactions: 10,
          },
          {
            outlet_code: "OUT2",
            last_synced_at: null,
            last_sale_date: null,
            total_transactions: 0,
          },
        ],
      }),
    ),
  );
});

describe("Aksesibilitas dasar (8.7)", () => {
  it("form login bebas pelanggaran WCAG A/AA", async () => {
    const { container } = render(<LoginForm />);

    expect(await periksa(container)).toEqual([]);
  });

  it("form ganti kata sandi bebas pelanggaran", async () => {
    const { container } = render(<ChangePasswordForm />);

    expect(await periksa(container)).toEqual([]);
  });

  it("tabel status sync bebas pelanggaran", async () => {
    const { container } = renderWithQuery(<SyncStatusView />);
    await screen.findByText("OUT1");

    expect(await periksa(container)).toEqual([]);
  });

  it("halaman 403 bebas pelanggaran", async () => {
    const { container } = render(<AksesDitolak role="manager" />);

    expect(await periksa(container)).toEqual([]);
  });

  it("halaman kelola product group bebas pelanggaran (10.20)", async () => {
    server.use(
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
            {
              id: 2,
              product_group: "PROMO LAMA",
              is_active: false,
              created_at: "2026-09-01T08:00:00",
              updated_at: "2026-09-10T08:00:00",
            },
          ],
        }),
      ),
      http.get("/api/sales/product-groups", () =>
        HttpResponse.json({ success: true, data: ["COLORPLATE", "MINUMAN"] }),
      ),
    );

    const { container } = renderWithQuery(<ProductGroupsView />);
    await screen.findByText("PROMO LAMA");
    // Saran ikut dirender — tombolnya juga harus lolos pemeriksaan.
    await screen.findByRole("button", { name: "MINUMAN" });

    expect(await periksa(container)).toEqual([]);
  });

  it("rekap per group bebas pelanggaran", async () => {
    server.use(
      http.get("/api/sales/product-groups", () =>
        HttpResponse.json({ success: true, data: ["COLORPLATE", "MINUMAN"] }),
      ),
      http.get("/api/sales/by-group", () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              product_group: "COLORPLATE",
              product_name: "Piring Merah",
              outlet_code: "OUT1",
              sale_date: "2026-09-12",
              sold: 4,
            },
          ],
        }),
      ),
    );

    const { container } = renderWithQuery(
      <GroupRecap
        filter={{ start_date: "2026-09-01", end_date: "2026-09-12" }}
        terpilih={["COLORPLATE"]}
        onTerpilihChange={vi.fn()}
      />,
    );
    await screen.findByText("Piring Merah");

    expect(await periksa(container)).toEqual([]);
  });

  it("perbandingan closing vs POS bebas pelanggaran", async () => {
    server.use(
      http.get("/api/outlets", () =>
        HttpResponse.json({
          success: true,
          data: [{ outlet_code: "OUT1", is_active: true, brand_code: null }],
        }),
      ),
      http.get("/api/closing-reports/comparison", () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              outlet_code: "OUT1",
              production_date: "2026-09-12",
              menu_id: "0a1b2c3d-4e5f-4a7b-8c9d-0e1f2a3b4c5d",
              menu_code: "SU-001",
              menu_name: "Salmon Nigiri",
              sold: 5,
              waste: 1,
              adjustment: -1,
              compensation: 0,
              products: [
                {
                  product_id: 900001,
                  product_name: "RED",
                  multiplier: 1,
                  is_mapped: true,
                },
              ],
              pos_qty: 3,
            },
          ],
        }),
      ),
    );

    const { container } = renderWithQuery(<ClosingView role="admin" />);
    await screen.findByText("Salmon Nigiri");

    expect(await periksa(container)).toEqual([]);
  });

  it("panel kirim rekap closing ke API bebas pelanggaran", async () => {
    const kiriman = {
      id: 1,
      outlet_code: "OUT1",
      production_date: "2026-09-12",
      sequence: 1,
      message_id: "6f1c2a7e-3b4d-4e8f-9a10-2b3c4d5e6f70",
      status: "gagal",
      attempts: 3,
      http_status: 503,
      error: "HTTP 503",
      item_count: 2,
      sent_by: "admin@maharasa.id",
      created_at: "2026-09-13T01:00:00",
      started_at: "2026-09-13T01:00:00",
      finished_at: "2026-09-13T01:00:05",
    };
    server.use(
      http.get("/api/closing-exports/status", () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              outlet_code: "OUT1",
              production_date: "2026-09-12",
              status: "perlu_kirim_ulang",
              can_send: false,
              item_count: 2,
              total_sold: 8,
              menu_belum_dipetakan: [
                { menu_id: "a", menu_code: "SU-009", menu_name: "Uni" },
              ],
              produk_dobel: [],
              last_attempt: kiriman,
              last_sent: { ...kiriman, status: "terkirim", http_status: 201 },
            },
          ],
        }),
      ),
      http.get("/api/closing-exports", () =>
        HttpResponse.json({
          success: true,
          data: [kiriman],
          pagination: { limit: 50, offset: 0, total: 1, has_more: false },
        }),
      ),
    );

    const { container } = renderWithQuery(
      <ClosingExportPanel
        filter={{ start_date: "2026-09-12", end_date: "2026-09-12" }}
      />,
    );
    await screen.findByRole("table", { name: /riwayat kiriman/i });

    expect(await periksa(container)).toEqual([]);
  });

  it("halaman mapping menu closing bebas pelanggaran", async () => {
    server.use(
      http.get("/api/closing-menus", () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 1,
              menu_code: "SU-001",
              menu_id: "0a1b2c3d-4e5f-4a7b-8c9d-0e1f2a3b4c5d",
              menu_name: "Salmon Nigiri",
              is_mapped: false,
              products: [],
              first_seen_at: "2026-09-12T08:00:00",
              last_seen_at: "2026-09-12T08:00:00",
            },
          ],
        }),
      ),
    );

    const { container } = renderWithQuery(<ClosingMenusView />);
    await screen.findByText("Salmon Nigiri");

    expect(await periksa(container)).toEqual([]);
  });

  it("halaman pesan RabbitMQ bebas pelanggaran", async () => {
    server.use(
      http.get("/api/closing-messages", () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 1,
              received_at: "2026-10-02T15:15:02",
              status: "ditolak",
              reason: "gagal validasi",
              warnings: ["compensation negatif: 1 menu"],
              message_id: "6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b",
              outlet_code: "STTSM",
              closing_report_id: null,
              report_date: null,
              item_count: null,
              revision_id: null,
              body_bytes: 512,
            },
          ],
          pagination: { limit: 50, offset: 0, total: 1, has_more: false },
          counts: {
            baru: 0,
            revisi: 0,
            revisi_lama: 0,
            duplikat: 0,
            ditolak: 1,
          },
        }),
      ),
    );

    const { container } = renderWithQuery(<ClosingMessagesView />);
    await screen.findByText("gagal validasi");

    expect(await periksa(container)).toEqual([]);
  });
});

describe("Fokus keyboard (8.7)", () => {
  it("form login bisa dilalui hanya dengan Tab, berurutan", async () => {
    render(<LoginForm />);
    const user = userEvent.setup();

    const email = screen.getByLabelText(/email/i);
    const sandi = screen.getByLabelText(/kata sandi/i);
    const tombol = screen.getByRole("button", { name: /masuk/i });

    email.focus();
    expect(email).toHaveFocus();

    await user.tab();
    expect(sandi).toHaveFocus();

    await user.tab();
    expect(tombol).toHaveFocus();
  });

  it("form bisa dikirim dengan Enter, tanpa menyentuh tetikus", async () => {
    let dikirim = false;
    server.use(
      http.post("/api/auth/login", () => {
        dikirim = true;
        return HttpResponse.json({ user: {} });
      }),
    );

    render(<LoginForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), "a@b.id");
    await user.type(screen.getByLabelText(/kata sandi/i), "rahasia1{Enter}");

    expect(dikirim).toBe(true);
  });
});

describe("Label form (8.7)", () => {
  it("aturan label axe ikut dijalankan, bukan sekadar diasumsikan", async () => {
    // Ditegaskan di sini supaya jelas bahwa "setiap input punya label"
    // benar-benar diperiksa — tiga blok di atas mengandalkan aturan ini.
    const { container } = render(<ChangePasswordForm />);

    const hasil = await axe.run(container, {
      runOnly: { type: "rule", values: ["label"] },
    });

    expect(hasil.violations).toEqual([]);
    // Kalau aturannya tidak berlaku sama sekali, hasilnya kosong dan
    // pemeriksaan di atas jadi hampa — jadi pastikan ada yang lolos.
    expect(hasil.passes.length).toBeGreaterThan(0);
  });
});
