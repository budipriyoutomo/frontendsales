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
