import { expect, test } from "@playwright/test";
import { masuk } from "./helpers";

/** TODO 8.2 — alur buat & rotate API key. */
test.describe("API key (8.2)", () => {
  test.beforeEach(async ({ page }) => {
    await masuk(page, "admin");
    await page.goto("/api-keys");
  });

  test("membuat key baru menampilkan key mentah sekali dan bisa disalin (6.5)", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const kode = `OUTLET_E2E_${Date.now().toString().slice(-5)}`;
    await page.getByLabel(/kode outlet/i).fill(kode);
    await page.getByRole("button", { name: /buat key/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const keyMentah = `mhr_baru_${kode}_rahasia`;
    await expect(dialog.getByText(keyMentah)).toBeVisible();
    // Peringatan sekali-lihat harus benar-benar terbaca.
    await expect(dialog.getByRole("alert")).toContainText(
      /hanya ditampilkan sekali/i,
    );

    await dialog.getByRole("button", { name: /salin api key/i }).click();
    const tersalin = await page.evaluate(() => navigator.clipboard.readText());
    expect(tersalin).toBe(keyMentah);

    await dialog.getByRole("button", { name: /sudah menyimpannya/i }).click();

    // Ditutup berarti hilang: key mentah tidak boleh tersisa di mana pun.
    await expect(dialog).toBeHidden();
    await expect(page.getByText(keyMentah)).toBeHidden();

    // Daftar hanya menampilkan awalannya.
    await expect(page.getByRole("row").filter({ hasText: kode })).toBeVisible();
  });

  test("outlet yang sudah punya key ditolak dan diarahkan ke Rotate (6.2)", async ({
    page,
  }) => {
    // OUTLET_001 sudah punya key dari awal.
    await page.getByLabel(/kode outlet/i).fill("OUTLET_001");
    await page.getByRole("button", { name: /buat key/i }).click();

    await expect(page.getByText(/sudah punya api key/i)).toBeVisible();
    await expect(page.getByText(/gunakan tombol rotate/i)).toBeVisible();
  });

  test("rotate menuntut kode outlet diketik ulang (6.6, 6.14)", async ({
    page,
  }) => {
    const baris = page.getByRole("row").filter({ hasText: "OUTLET_001" });
    await baris.getByRole("button", { name: "Rotate" }).click();

    const dialog = page.getByRole("dialog");
    const tombol = dialog.getByRole("button", { name: /rotate key/i });

    // Peringatan menyebut akibatnya di lapangan, bukan sekadar "yakin?".
    await expect(dialog).toContainText(/berhenti mengirim data/i);
    await expect(tombol).toBeDisabled();

    await dialog.getByLabel(/ketik/i).fill("OUTLET_00");
    await expect(tombol).toBeDisabled();

    await dialog.getByLabel(/ketik/i).fill("OUTLET_001");
    await expect(tombol).toBeEnabled();
  });

  test("rotate yang dikonfirmasi menghasilkan key mentah baru (6.3)", async ({
    page,
  }) => {
    const baris = page.getByRole("row").filter({ hasText: "OUTLET_001" });
    await baris.getByRole("button", { name: "Rotate" }).click();

    const konfirmasi = page.getByRole("dialog");
    await konfirmasi.getByLabel(/ketik/i).fill("OUTLET_001");
    await konfirmasi.getByRole("button", { name: /rotate key/i }).click();

    const dialogKey = page.getByRole("dialog");
    await expect(
      dialogKey.getByText("mhr_rotasi_OUTLET_001_rahasia"),
    ).toBeVisible();
  });

  test("revoke juga dikonfirmasi, lalu key jadi nonaktif (6.4)", async ({
    page,
  }) => {
    const kode = `OUTLET_CABUT_${Date.now().toString().slice(-5)}`;
    await page.getByLabel(/kode outlet/i).fill(kode);
    await page.getByRole("button", { name: /buat key/i }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /sudah menyimpannya/i })
      .click();

    const baris = page.getByRole("row").filter({ hasText: kode });
    await baris.getByRole("button", { name: "Revoke" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/ketik/i).fill(kode);
    await dialog.getByRole("button", { name: /cabut key/i }).click();

    await expect(baris.getByText("Dicabut")).toBeVisible();
    // Yang sudah dicabut tidak bisa dicabut lagi.
    await expect(baris.getByRole("button", { name: "Revoke" })).toBeDisabled();
  });
});
