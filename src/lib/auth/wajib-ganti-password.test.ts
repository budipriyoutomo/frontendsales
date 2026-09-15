import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { perluGantiPassword } from "@/lib/auth/wajib-ganti-password";
import type { CurrentUser } from "@/lib/auth/current-user";

function user(extra: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: 1,
    email: "a@maharasa.id",
    full_name: null,
    role: "admin",
    outlet_code: null,
    is_active: true,
    must_change_password: false,
    ...extra,
  };
}

describe("perluGantiPassword (2.8)", () => {
  it("memaksa user yang passwordnya masih sementara", () => {
    expect(perluGantiPassword(user({ must_change_password: true }))).toBe(true);
  });

  it("tidak mengganggu user yang passwordnya sudah miliknya sendiri", () => {
    expect(perluGantiPassword(user())).toBe(false);
  });

  it("berlaku untuk semua role, bukan cuma admin", () => {
    for (const role of ["admin", "manager", "outlet"] as const) {
      expect(
        perluGantiPassword(user({ role, must_change_password: true })),
      ).toBe(true);
    }
  });

  it("memperlakukan penanda yang tidak ada sebagai tidak wajib", () => {
    // Backend versi lama tidak mengirim field ini — jangan mengunci orang
    // keluar hanya karena kontraknya belum diperbarui.
    const tanpaField = user();
    delete (tanpaField as Partial<CurrentUser>).must_change_password;

    expect(perluGantiPassword(tanpaField)).toBe(false);
  });
});

describe("letak halaman ganti password (2.8)", () => {
  // Yang mencegah pantulan tanpa henti bukan logika, melainkan letak berkas:
  // `/ganti-password` harus berada DI LUAR route group `(app)`, karena di
  // sanalah penjaga `perluGantiPassword` dipasang. Pengecualian berbasis
  // pathname pernah dicoba dan gagal — header pathname dari `proxy.ts` tidak
  // sampai pada request RSC, jadi penjaganya memantulkan halaman itu sendiri.
  //
  // Kalau berkasnya dipindahkan kembali ke `(app)`, test ini merah sebelum
  // ada yang sempat menemukannya lewat browser.
  const akar = path.resolve(import.meta.dirname, "../../..");

  it("berada di luar route group (app)", () => {
    expect(existsSync(path.join(akar, "src/app/(app)/ganti-password"))).toBe(
      false,
    );
  });

  it("ada di route group sendiri, lengkap dengan layoutnya", () => {
    expect(
      existsSync(
        path.join(akar, "src/app/(ganti-password)/ganti-password/page.tsx"),
      ),
    ).toBe(true);
    expect(
      existsSync(path.join(akar, "src/app/(ganti-password)/layout.tsx")),
    ).toBe(true);
  });
});
