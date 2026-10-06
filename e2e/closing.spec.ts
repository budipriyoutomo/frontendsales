import { expect, test, type Page } from "@playwright/test";
import { masuk } from "./helpers";

/**
 * TODO 11.6 — closing report dari RabbitMQ: perbandingan POS, detail
 * laporan, mapping menu (admin), dan batas per role.
 *
 * Backend tiruan menyimpan mapping di memori dan bisa dipakai ulang antar run
 * lokal (`reuseExistingServer`), jadi test mapping tidak boleh bergantung
 * pada SU-001 masih belum dipetakan.
 */

function barisMenu(page: Page, outlet: string, menu: string) {
  return page
    .getByRole("row")
    .filter({ hasText: outlet })
    .filter({ hasText: menu });
}

test.describe("Closing report (11.6)", () => {
  test("admin memetakan menu, lalu perbandingan POS menjadi cocok", async ({
    page,
  }) => {
    await masuk(page, "admin");
    await page.goto("/closing-menu");

    await page.getByRole("combobox", { name: /status/i }).click();
    await page.getByRole("option", { name: "Semua" }).click();
    await page
      .getByRole("row")
      .filter({ hasText: "Salmon Nigiri" })
      .getByRole("button", { name: /atur mapping/i })
      .click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/cari produk pos/i).fill("salmon");
    const kandidat = dialog
      .getByRole("list", { name: /hasil pencarian produk pos/i })
      .getByRole("listitem")
      .filter({ hasText: "Salmon HR" });
    const tambahkan = kandidat.getByRole("button", { name: "Tambahkan" });
    // Tunggu hasil pencarian (debounce + fetch) sebelum memeriksa tombolnya.
    await expect(kandidat).toBeVisible();
    // Di run lokal kedua, mapping dari run pertama masih ada.
    if (await tambahkan.isVisible()) await tambahkan.click();
    await expect(kandidat.getByText(/sudah dipetakan/i)).toBeVisible();
    await expect(dialog.getByText("ProductID 200104")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/closing");
    await expect(
      barisMenu(page, "OUTLET_001", "Salmon Nigiri").getByText("Cocok"),
    ).toBeVisible();
    // Tuna: closing 12, POS 10 → selisih = POS − closing = −2.
    const tuna = barisMenu(page, "OUTLET_001", "Tuna Nigiri");
    await expect(tuna.getByText("Selisih", { exact: true })).toBeVisible();
    await expect(tuna.getByText("−2")).toBeVisible();
  });

  test("detail laporan memperlihatkan item dan revisi aktif", async ({
    page,
  }) => {
    await masuk(page, "admin");
    await page.goto("/closing?tab=laporan");

    await page
      .getByRole("row")
      .filter({ hasText: "OUTLET_001" })
      .getByRole("button", { name: "Detail" })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Salmon Nigiri")).toBeVisible();
    await expect(dialog.getByText("Aktif", { exact: true })).toBeVisible();
  });

  test("role outlet hanya melihat closing outletnya sendiri", async ({
    page,
  }) => {
    await masuk(page, "outlet");
    await page.goto("/closing");

    await expect(barisMenu(page, "OUTLET_001", "Salmon Nigiri")).toBeVisible();
    await expect(page.getByRole("cell", { name: "OUTLET_002" })).toHaveCount(0);
  });

  test("manager membaca closing, tapi tidak bisa membuka mapping menu", async ({
    page,
  }) => {
    await masuk(page, "manager");

    const nav = page.getByRole("navigation", { name: /menu utama/i }).first();
    await expect(nav.getByRole("link", { name: "Closing" })).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Mapping Closing" }),
    ).toBeHidden();

    await page.goto("/closing-menu");
    await expect(page.getByText(/halaman ini tidak untuk anda/i)).toBeVisible();
    await expect(page.getByText("Salmon Nigiri")).toHaveCount(0);
  });

  test("admin memeriksa pesan RabbitMQ yang ditolak beserta JSON-nya", async ({
    page,
  }) => {
    await masuk(page, "admin");
    await page
      .getByRole("navigation", { name: /menu utama/i })
      .first()
      .getByRole("link", { name: "Pesan RabbitMQ" })
      .click();
    await expect(page).toHaveURL(/\/closing-pesan/);

    await page.getByRole("button", { name: "Ditolak (1)" }).click();
    const baris = page.getByRole("row").filter({ hasText: "pesan-rusak-001" });
    await expect(baris.getByText("gagal validasi")).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: "pesan-baik-001" }),
    ).toHaveCount(0);

    await baris.getByRole("button", { name: "Detail" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Input should be 1")).toBeVisible();
    await expect(dialog.locator("pre")).toContainText('"version": 2');
  });

  test("pesan RabbitMQ hanya untuk admin", async ({ page }) => {
    await masuk(page, "manager");

    const nav = page.getByRole("navigation", { name: /menu utama/i }).first();
    await expect(
      nav.getByRole("link", { name: "Pesan RabbitMQ" }),
    ).toBeHidden();

    await page.goto("/closing-pesan");
    await expect(page.getByText(/halaman ini tidak untuk anda/i)).toBeVisible();
    await expect(page.getByText("pesan-rusak-001")).toHaveCount(0);
  });
});
