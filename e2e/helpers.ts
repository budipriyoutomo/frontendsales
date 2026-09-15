import { expect, type Page } from "@playwright/test";

export const AKUN = {
  admin: { email: "admin@maharasa.test", password: "rahasia123" },
  manager: { email: "manager@maharasa.test", password: "rahasia123" },
  outlet: { email: "outlet@maharasa.test", password: "rahasia123" },
} as const;

export type Peran = keyof typeof AKUN;

/** Masuk lewat form sungguhan, bukan dengan menyuntik cookie — alur login
 *  itu sendiri bagian dari yang diuji. */
export async function masuk(page: Page, peran: Peran = "admin") {
  const akun = AKUN[peran];

  await page.goto("/login");
  await page.getByLabel("Email").fill(akun.email);
  await page.getByLabel(/kata sandi/i).fill(akun.password);
  await page.getByRole("button", { name: /masuk/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
}

export async function keluar(page: Page) {
  await page
    .getByRole("button", { name: /admin uji|manager uji|kasir uji/i })
    .click();
  await page.getByRole("menuitem", { name: /keluar/i }).click();
  await expect(page).toHaveURL(/\/login/);
}
