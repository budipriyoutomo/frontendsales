import { expect, test } from "@playwright/test";
import { AKUN, keluar, masuk } from "./helpers";

/** TODO 8.1 — login → dashboard → transaksi → logout. */
test.describe("Alur utama (8.1)", () => {
  test("login, lihat dashboard, buka transaksi, lalu keluar", async ({
    page,
  }) => {
    await masuk(page, "admin");

    // Dashboard menampilkan angka dari API, terformat id-ID.
    await expect(
      page.getByRole("heading", { name: "Dashboard", level: 1 }),
    ).toBeVisible();
    // `.first()`: "Omzet" muncul dua kali di halaman ini — judul kartu
    // ringkasan dan header kolom tabel produk terlaris.
    await expect(
      page.getByText("Omzet", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText(/^Rp\s[\d.]+$/).first()).toBeVisible();

    // Grafik omzet harian ikut terender.
    await expect(
      page.getByRole("heading", { name: /omzet harian/i }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Transaksi" }).click();
    await expect(page).toHaveURL(/\/transaksi/);
    await expect(page.getByText("REF-0001")).toBeVisible();

    await keluar(page);

    // Setelah keluar, halaman terlindungi tidak bisa dibuka lagi.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("token tidak pernah bisa dibaca JavaScript halaman (0.2)", async ({
    page,
  }) => {
    await masuk(page, "admin");

    const terlihat = await page.evaluate(() => document.cookie);
    expect(terlihat).not.toContain("mh_at");
    expect(terlihat).not.toContain("mh_rt");

    // Tapi cookienya memang ada — hanya httpOnly.
    const cookies = await page.context().cookies();
    const sesi = cookies.filter(
      (c) => c.name === "mh_at" || c.name === "mh_rt",
    );
    expect(sesi).toHaveLength(2);
    expect(sesi.every((c) => c.httpOnly)).toBe(true);
  });

  test("halaman terlindungi mengingat tujuan lalu mengembalikannya (2.3)", async ({
    page,
  }) => {
    await page.goto("/transaksi");
    await expect(page).toHaveURL(/\/login\?next=%2Ftransaksi/);

    await page.getByLabel("Email").fill(AKUN.admin.email);
    await page.getByLabel(/kata sandi/i).fill(AKUN.admin.password);
    await page.getByRole("button", { name: /masuk/i }).click();

    // Kembali ke halaman yang tadi dituju, bukan ke dashboard.
    await expect(page).toHaveURL(/\/transaksi/);
  });

  test("kredensial salah menampilkan pesan, bukan membuka dashboard (2.10)", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(AKUN.admin.email);
    await page.getByLabel(/kata sandi/i).fill("salahsekali");
    await page.getByRole("button", { name: /masuk/i }).click();

    // Dibatasi ke dalam form: Next memasang route-announcer yang juga
    // ber-`role="alert"` di tingkat dokumen.
    await expect(page.locator("form").getByRole("alert")).toContainText(
      /salah/i,
    );
    await expect(page).toHaveURL(/\/login/);
  });

  test("429 menampilkan lama tunggu, bukan pesan kredensial salah (2.11)", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(AKUN.admin.email);
    // Kata sandi sandi khusus yang membuat backend tiruan menjawab 429.
    await page.getByLabel(/kata sandi/i).fill("__RATE_LIMIT__");
    await page.getByRole("button", { name: /masuk/i }).click();

    const alert = page.locator("form").getByRole("alert");
    await expect(alert).toContainText(/5 menit/i);
    await expect(alert).not.toContainText(/kata sandi salah/i);
    await expect(page.getByRole("button", { name: /tunggu/i })).toBeDisabled();
  });
});

test.describe("Sesi (8.1)", () => {
  test("401 di tengah sesi di-refresh diam-diam, user tidak terlempar (2.12)", async ({
    page,
    request,
  }) => {
    await masuk(page, "admin");

    // Pesan satu 401 berikutnya di backend tiruan.
    const cookies = await page.context().cookies();
    const at = cookies.find((c) => c.name === "mh_at")!.value;
    await request.post("http://127.0.0.1:8788/__paksa-401", {
      headers: { Authorization: `Bearer ${at}` },
    });

    await page.getByRole("link", { name: "Status Sync" }).click();

    // Proxy BFF me-refresh lalu mengulang request — halaman tetap terisi
    // dan user tidak pernah melihat /login.
    await expect(page.getByText("OUTLET_001")).toBeVisible();
    await expect(page).toHaveURL(/\/status-sync/);
  });
});

test.describe("Transaksi (8.1)", () => {
  test.beforeEach(async ({ page }) => {
    await masuk(page, "admin");
    await page.goto("/transaksi");
  });

  test("pindah halaman mengubah URL dan isi tabel (5.2, 5.7)", async ({
    page,
  }) => {
    await expect(page.getByText("REF-0001")).toBeVisible();

    await page.getByRole("button", { name: /berikutnya/i }).click();

    await expect(page).toHaveURL(/offset=50/);
    await expect(page.getByText("REF-0051")).toBeVisible();
    await expect(page.getByText("REF-0001")).toBeHidden();
  });

  test("menandai transaksi void secara visual (5.5)", async ({ page }) => {
    const baris = page.getByRole("row").filter({ hasText: "REF-0002" });
    await expect(baris.getByText("Void")).toBeVisible();
  });

  test("detail transaksi menampilkan itemnya (5.3)", async ({ page }) => {
    await page
      .getByRole("row")
      .filter({ hasText: "REF-0001" })
      .getByRole("button", { name: /detail/i })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Es Teh Manis")).toBeVisible();
  });

  test("ekspor memicu unduhan berkas, bukan CSV mentah di layar (5.4, 5.9)", async ({
    page,
  }) => {
    const unduhan = page.waitForEvent("download");
    await page.getByRole("button", { name: /ekspor csv/i }).click();

    const berkas = await unduhan;
    // Nama berkas diambil dari Content-Disposition backend.
    expect(berkas.suggestedFilename()).toBe("transaksi_uji.csv");
    await expect(page.getByText("transaction_id,reference_no")).toBeHidden();
  });
});

test.describe("Paksa ganti kata sandi (8.1, 2.8)", () => {
  test("akun dengan kata sandi sementara dilempar ke halaman ganti", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("baru@maharasa.test");
    await page.getByLabel(/kata sandi/i).fill("sementara123");
    await page.getByRole("button", { name: /masuk/i }).click();

    await expect(page).toHaveURL(/\/ganti-password/);
    await expect(page.getByText(/masih ditentukan orang lain/i)).toBeVisible();
  });

  test("halaman lain tetap tertutup sampai kata sandi diganti", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("baru@maharasa.test");
    await page.getByLabel(/kata sandi/i).fill("sementara123");
    await page.getByRole("button", { name: /masuk/i }).click();
    await expect(page).toHaveURL(/\/ganti-password/);

    // Mencoba menyelinap langsung ke dashboard tetap dipantulkan.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/ganti-password/);

    await page.goto("/transaksi");
    await expect(page).toHaveURL(/\/ganti-password/);
  });

  test("setelah diganti, dashboard terbuka dan tidak memantul lagi", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("baru@maharasa.test");
    await page.getByLabel(/kata sandi/i).fill("sementara123");
    await page.getByRole("button", { name: /masuk/i }).click();
    await expect(page).toHaveURL(/\/ganti-password/);

    await page.getByLabel(/kata sandi saat ini/i).fill("sementara123");
    await page.getByLabel(/^kata sandi baru/i).fill("punyasendiri1");
    await page.getByLabel(/ulangi/i).fill("punyasendiri1");
    await page.getByRole("button", { name: /simpan kata sandi baru/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    // Pindah halaman lagi tidak boleh memantul balik.
    await page.goto("/transaksi");
    await expect(page).toHaveURL(/\/transaksi/);
  });
});
