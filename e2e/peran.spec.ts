import { expect, test } from "@playwright/test";
import { masuk } from "./helpers";

/** TODO 8.3 — E2E per role (admin, manager, outlet). */

test.describe("Admin (8.3)", () => {
  test("melihat seluruh menu", async ({ page }) => {
    await masuk(page, "admin");

    const nav = page.getByRole("navigation", { name: /menu utama/i }).first();
    for (const menu of [
      "Dashboard",
      "Transaksi",
      "Status Sync",
      "API Key",
      "Product Group",
      "Pengguna",
    ]) {
      await expect(nav.getByRole("link", { name: menu })).toBeVisible();
    }
  });

  test("bisa membuka halaman administrasi", async ({ page }) => {
    await masuk(page, "admin");

    await page.goto("/pengguna");
    await expect(
      page.getByRole("heading", { name: "Pengguna", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("admin@maharasa.test")).toBeVisible();
  });

  test("tombol nonaktifkan mati untuk akun sendiri (6.11, 6.15)", async ({
    page,
  }) => {
    await masuk(page, "admin");
    await page.goto("/pengguna");

    const baris = page
      .getByRole("row")
      .filter({ hasText: "admin@maharasa.test" });

    // `exact`: kata "Anda" juga muncul di kalimat alasan di bawah tombol.
    await expect(baris.getByText("Anda", { exact: true })).toBeVisible();
    await expect(
      baris.getByRole("button", { name: /nonaktifkan/i }),
    ).toBeDisabled();
    await expect(baris).toContainText(/akun Anda sendiri/i);
  });
});

test.describe("Manager (8.3)", () => {
  test("tidak melihat menu API key dan Pengguna (3.7)", async ({ page }) => {
    await masuk(page, "manager");

    const nav = page.getByRole("navigation", { name: /menu utama/i }).first();
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Transaksi" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "API Key" })).toBeHidden();
    await expect(nav.getByRole("link", { name: "Pengguna" })).toBeHidden();
    await expect(nav.getByRole("link", { name: "Product Group" })).toBeHidden();
  });

  test("membuka /product-group langsung mendapat 403, isinya tidak terkirim (10.16)", async ({
    page,
  }) => {
    await masuk(page, "manager");
    await page.goto("/product-group");

    await expect(page.getByText(/halaman ini tidak untuk anda/i)).toBeVisible();
    await expect(page.getByLabel(/nama group/i)).toHaveCount(0);
    await expect(page.getByText("COLORPLATE")).toHaveCount(0);
  });

  test("membuka /pengguna langsung mendapat 403 yang jelas, bukan crash (3.9)", async ({
    page,
  }) => {
    await masuk(page, "manager");
    await page.goto("/pengguna");

    await expect(page.getByText(/halaman ini tidak untuk anda/i)).toBeVisible();
    // Isi halaman tidak ikut terkirim.
    await expect(page.getByText("admin@maharasa.test")).toBeHidden();
    // Ada jalan keluar.
    await expect(
      page.getByRole("link", { name: /kembali ke dashboard/i }),
    ).toBeVisible();
  });

  test("tetap melihat pemilih outlet dan perbandingan antar outlet", async ({
    page,
  }) => {
    await masuk(page, "manager");

    await expect(page.getByLabel("Outlet")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /omzet per outlet/i }),
    ).toBeVisible();
  });
});

test.describe("Outlet (8.3)", () => {
  test("hanya melihat tiga menu yang jadi haknya", async ({ page }) => {
    await masuk(page, "outlet");

    const nav = page.getByRole("navigation", { name: /menu utama/i }).first();
    await expect(nav.getByRole("link")).toHaveCount(3);
    await expect(nav.getByRole("link", { name: "API Key" })).toBeHidden();
    await expect(nav.getByRole("link", { name: "Pengguna" })).toBeHidden();
  });

  test("tidak melihat pemilih outlet maupun perbandingan antar outlet (3.8)", async ({
    page,
  }) => {
    await masuk(page, "outlet");

    // Server mengabaikan `?outlet=` untuk role ini, jadi menampilkan filter
    // yang tidak berefek hanya membingungkan.
    await expect(page.getByLabel("Outlet")).toBeHidden();
    await expect(
      page.getByRole("heading", { name: /omzet per outlet/i }),
    ).toBeHidden();
  });

  test("hanya melihat transaksi outletnya sendiri", async ({ page }) => {
    await masuk(page, "outlet");
    await page.goto("/transaksi");

    await expect(page.getByText("REF-0001")).toBeVisible();

    const kolomOutlet = page.getByRole("cell", { name: "OUTLET_002" });
    await expect(kolomOutlet).toHaveCount(0);
  });

  test("menu user menampilkan outlet yang menjadi scope-nya (3.5)", async ({
    page,
  }) => {
    await masuk(page, "outlet");

    await page.getByRole("button", { name: /kasir uji/i }).click();
    await expect(page.getByText(/outlet · OUTLET_001/i)).toBeVisible();
  });
});
