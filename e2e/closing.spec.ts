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
  test("admin memetakan menu, lalu qty POS muncul di samping Colorplate", async ({
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
    // Salmon: terjual 42, POS 42 dari ProductID 200104.
    const salmon = barisMenu(page, "OUTLET_001", "Salmon Nigiri");
    await expect(salmon.getByText("200104")).toBeVisible();
    await expect(salmon.getByRole("cell").nth(-5)).toHaveText("42");
    // Total Sold = Colorplate terjual 42 + qty POS 42.
    await expect(salmon.getByRole("cell").nth(-4)).toHaveText("84");
    // Tuna: terjual 12, POS 10.
    const tuna = barisMenu(page, "OUTLET_001", "Tuna Nigiri");
    await expect(tuna.getByRole("cell").nth(3)).toHaveText("12");
    await expect(tuna.getByRole("cell").nth(-5)).toHaveText("10");
    // OUTLET_002 menjual produk Tuna (7), tapi Tuna tidak ada di colorplate-nya.
    const hanyaPos = barisMenu(page, "OUTLET_002", "Tidak ada di Colorplate");
    await expect(hanyaPos.getByRole("cell").nth(-5)).toHaveText("7");
    // Transaksi POS bukan colorplate juga tampil.
    const esTeh = barisMenu(page, "OUTLET_001", "Es Teh");
    await expect(esTeh.getByText("Tidak ada di Colorplate")).toBeVisible();
    await expect(esTeh.getByText("Belum dipetakan ke menu")).toBeVisible();
    await expect(esTeh.getByRole("cell").nth(-5)).toHaveText("15");
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

test.describe("Kirim rekap closing ke API (backend Fase 8)", () => {
  test("admin mengirim rekap satu outlet, lalu melihat payload di riwayat", async ({
    page,
  }) => {
    await masuk(page, "admin");
    // Menu SU-001 harus terpetakan supaya OUTLET_001 tidak diblokir; 409 =
    // sudah dipetakan oleh test lain / run sebelumnya.
    // Lewat fetch dari halaman — jalur BFF yang sama dengan aplikasi.
    const kode = await page.evaluate(async () => {
      const res = await fetch("/api/closing-menus/1/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: 200104, multiplier: 1 }),
      });
      return res.status;
    });
    expect([201, 409]).toContain(kode);

    await page.goto("/closing?tab=kirim");
    const status = page.getByRole("table", { name: /status kirim/i });
    const baris = status.getByRole("row").filter({ hasText: "OUTLET_001" });
    // Salmon 42 + 42, Tuna 12 + 10, Es Teh 0 + 15.
    await expect(baris.getByRole("cell").nth(3)).toHaveText("121");

    await baris.getByRole("button", { name: /^kirim/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("OUTLET_001")).toBeVisible();
    await dialog.getByRole("button", { name: /^kirim$/i }).click();
    await expect(dialog).toBeHidden();

    await expect(baris.getByRole("cell").nth(4)).toHaveText(/^Terkirim/);

    const riwayat = page.getByRole("table", { name: /riwayat kiriman/i });
    const terbaru = riwayat.getByRole("row").nth(1);
    await expect(terbaru).toContainText("OUTLET_001");
    await expect(terbaru).toContainText("admin@maharasa.test");
    await terbaru.getByRole("button", { name: "Detail" }).click();

    const detail = page.getByRole("dialog");
    await expect(detail.getByText('{"received":true}')).toBeVisible();
    await expect(detail.locator("pre").last()).toContainText('"totalSold": 84');
  });

  test("tab kirim hanya untuk admin", async ({ page }) => {
    await masuk(page, "manager");
    await page.goto("/closing?tab=kirim");

    await expect(barisMenu(page, "OUTLET_001", "Salmon Nigiri")).toBeVisible();
    await expect(page.getByRole("tab", { name: /kirim ke api/i })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("table", { name: /status kirim/i }),
    ).toHaveCount(0);
  });
});
