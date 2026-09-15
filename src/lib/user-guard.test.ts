import { describe, expect, it } from "vitest";
import {
  bolehNonaktifkan,
  bolehUbahRole,
  validasiUserBaru,
} from "@/lib/user-guard";
import type { UserAdmin } from "@/types/domain";

function user(
  id: number,
  role: string,
  is_active = true,
  extra: Partial<UserAdmin> = {},
): UserAdmin {
  return {
    id,
    email: `u${id}@x.id`,
    full_name: null,
    role,
    outlet_code: null,
    is_active,
    created_at: null,
    updated_at: null,
    ...extra,
  } as UserAdmin;
}

describe("bolehNonaktifkan (6.11, 6.15)", () => {
  it("menolak menonaktifkan akun sendiri", () => {
    const saya = user(1, "admin");
    const hasil = bolehNonaktifkan(saya, 1, [saya, user(2, "admin")]);

    expect(hasil.boleh).toBe(false);
    if (!hasil.boleh) expect(hasil.alasan).toMatch(/akun Anda sendiri/i);
  });

  it("menolak menonaktifkan admin aktif terakhir", () => {
    const satu = user(2, "admin");
    const hasil = bolehNonaktifkan(satu, 1, [satu, user(3, "manager")]);

    expect(hasil.boleh).toBe(false);
    if (!hasil.boleh) expect(hasil.alasan).toMatch(/admin aktif terakhir/i);
  });

  it("mengizinkan menonaktifkan admin saat masih ada admin aktif lain", () => {
    const target = user(2, "admin");
    expect(bolehNonaktifkan(target, 1, [target, user(1, "admin")]).boleh).toBe(
      true,
    );
  });

  it("tidak menghitung admin nonaktif sebagai cadangan", () => {
    const target = user(2, "admin");
    const hasil = bolehNonaktifkan(target, 1, [
      target,
      user(3, "admin", false),
    ]);

    expect(hasil.boleh).toBe(false);
  });

  it("mengizinkan menonaktifkan user biasa", () => {
    const target = user(5, "outlet");
    expect(bolehNonaktifkan(target, 1, [target, user(1, "admin")]).boleh).toBe(
      true,
    );
  });
});

describe("bolehUbahRole (6.11)", () => {
  it("menolak menurunkan role sendiri", () => {
    const saya = user(1, "admin");
    const hasil = bolehUbahRole(saya, 1, "manager", [saya, user(2, "admin")]);

    expect(hasil.boleh).toBe(false);
    if (!hasil.boleh) expect(hasil.alasan).toMatch(/role akun Anda sendiri/i);
  });

  it("menolak menurunkan admin aktif terakhir", () => {
    const target = user(2, "admin");
    const hasil = bolehUbahRole(target, 1, "manager", [
      target,
      user(3, "manager"),
    ]);

    expect(hasil.boleh).toBe(false);
    if (!hasil.boleh) expect(hasil.alasan).toMatch(/admin aktif terakhir/i);
  });

  it("mengizinkan menaikkan role orang lain", () => {
    const target = user(5, "outlet");
    expect(
      bolehUbahRole(target, 1, "admin", [target, user(1, "admin")]).boleh,
    ).toBe(true);
  });

  it("mengizinkan menyimpan tanpa mengubah role sendiri", () => {
    const saya = user(1, "admin");
    expect(bolehUbahRole(saya, 1, "admin", [saya]).boleh).toBe(true);
  });
});

describe("validasiUserBaru (6.8, 6.16)", () => {
  it("menuntut kode outlet untuk role outlet", () => {
    const galat = validasiUserBaru({
      email: "a@b.id",
      password: "rahasia12",
      role: "outlet",
    });

    expect(galat.outlet_code).toMatch(/wajib punya kode outlet/i);
  });

  it("tidak menuntut kode outlet untuk admin dan manager", () => {
    for (const role of ["admin", "manager"]) {
      const galat = validasiUserBaru({
        email: "a@b.id",
        password: "rahasia12",
        role,
      });
      expect(galat.outlet_code).toBeUndefined();
    }
  });

  it("menolak kata sandi di bawah 8 karakter", () => {
    const galat = validasiUserBaru({
      email: "a@b.id",
      password: "pendek",
      role: "admin",
    });

    expect(galat.password).toMatch(/8 karakter/);
  });

  it("menolak email yang bentuknya salah", () => {
    expect(
      validasiUserBaru({
        email: "bukan-email",
        password: "rahasia12",
        role: "admin",
      }).email,
    ).toMatch(/tidak valid/i);
  });

  it("tidak melaporkan galat untuk input yang benar", () => {
    expect(
      validasiUserBaru({
        email: "a@b.id",
        password: "rahasia12",
        role: "outlet",
        outlet_code: "OUT1",
      }),
    ).toEqual({});
  });
});
