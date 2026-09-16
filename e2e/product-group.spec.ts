import { expect, test } from "@playwright/test";
import { masuk } from "./helpers";

/** TODO 10.19 — kelola product group dan rekap per group. */

test.describe("Kelola product group (10.19)", () => {
  test.beforeEach(async ({ page }) => {
    await masuk(page, "admin");
    await page.goto("/product-group");
  });

  test("tambah → nonaktifkan → aktifkan kembali, tanpa tombol hapus", async ({
    page,
  }) => {
    const akhiran = Date.now().toString().slice(-5);
    const normal = `PROMO E2E ${akhiran}`;

    await page.getByLabel(/nama group/i).fill(` promo e2e ${akhiran} `);
    // Bentuk yang akan tersimpan diperlihatkan sebelum dikirim.
    await expect(page.getByText(/akan tersimpan sebagai/i)).toContainText(
      normal,
    );
    await page.getByRole("button", { name: /tambah group/i }).click();

    const baris = page.getByRole("row").filter({ hasText: normal });
    await expect(baris.getByText("Aktif", { exact: true })).toBeVisible();
    await expect(baris.getByRole("button", { name: /hapus/i })).toHaveCount(0);

    await baris.getByRole("button", { name: "Nonaktifkan" }).click();
    let dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(/publish berikutnya/i);
    await dialog.getByRole("button", { name: /nonaktifkan group/i }).click();
    await expect(dialog).toBeHidden();
    await expect(baris.getByText("Nonaktif", { exact: true })).toBeVisible();

    await baris.getByRole("button", { name: "Aktifkan" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /aktifkan group/i }).click();
    await expect(dialog).toBeHidden();
    await expect(baris.getByText("Aktif", { exact: true })).toBeVisible();
  });

  test("group yang sudah terdaftar diarahkan ke daftar (10.14)", async ({
    page,
  }) => {
    // COLORPLATE sudah ada dari awal; huruf kecil tetap dianggap sama.
    await page.getByLabel(/nama group/i).fill("colorplate");
    await page.getByRole("button", { name: /tambah group/i }).click();

    await expect(page.getByText(/group ini sudah terdaftar/i)).toBeVisible();
    await expect(page.getByText(/aktifkan dari daftar/i)).toBeVisible();
  });

  test("saran dari data penjualan mengisi form", async ({ page }) => {
    const saran = page.getByRole("group", { name: /saran/i });
    await saran.getByRole("button", { name: "MAKANAN" }).click();

    await expect(page.getByLabel(/nama group/i)).toHaveValue("MAKANAN");
  });
});

test.describe("Rekap per group di dashboard (10.9–10.12)", () => {
  test("beberapa group terkirim sebagai param berulang dan tersimpan di URL", async ({
    page,
  }) => {
    await masuk(page, "admin");

    const pilihan = page.getByRole("group", { name: /pilih group/i });
    await pilihan.getByRole("button", { name: "COLORPLATE" }).click();
    await expect(page).toHaveURL(/product_group=COLORPLATE/);
    await pilihan.getByRole("button", { name: "MINUMAN" }).click();
    await expect(page).toHaveURL(
      /product_group=COLORPLATE&product_group=MINUMAN/,
    );

    // Backend tiruan tidak memecah "A,B" — baris dari kedua group hanya
    // muncul kalau param benar-benar berulang. Dibatasi ke kartu rekap:
    // "Es Teh Manis" juga ada di tabel Produk terlaris.
    const rekap = page.locator("[data-slot=card]").filter({
      has: page.getByRole("heading", { name: /rekap per product group/i }),
    });
    await expect(
      rekap.getByRole("cell", { name: "Piring Merah" }),
    ).toBeVisible();
    await expect(
      rekap.getByRole("cell", { name: "Es Teh Manis" }),
    ).toBeVisible();

    // Muat ulang: pilihan kembali dari URL.
    await page.reload();
    await expect(
      pilihan.getByRole("button", { name: "MINUMAN" }),
    ).toHaveAttribute("aria-pressed", "true");

    // Mengganti rentang tanggal tidak mengosongkan pilihan group.
    await page.getByRole("button", { name: "7 hari" }).click();
    await expect(page).toHaveURL(/start_date=\d{4}-\d{2}-\d{2}/);
    const params = new URL(page.url()).searchParams;
    expect(params.getAll("product_group")).toEqual(["COLORPLATE", "MINUMAN"]);
  });
});
