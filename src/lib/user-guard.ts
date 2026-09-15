import type { UserAdmin } from "@/types/domain";

/**
 * Pagar yang sudah ditegakkan backend, ditampilkan sebagai UI (TODO 6.11).
 *
 * Tujuannya bukan keamanan — backend tetap menolak apa pun yang lolos dari
 * sini. Tujuannya supaya aturan itu terlihat sebagai tombol mati dengan
 * alasan, bukan sebagai error 400 setelah user menekan Simpan.
 */

export type Putusan = { boleh: true } | { boleh: false; alasan: string };

const BOLEH: Putusan = { boleh: true };

function adminAktifTerakhir(target: UserAdmin, semua: UserAdmin[]): boolean {
  if (target.role !== "admin" || !target.is_active) return false;
  return semua.filter((u) => u.role === "admin" && u.is_active).length <= 1;
}

export function bolehNonaktifkan(
  target: UserAdmin,
  sayaId: number,
  semua: UserAdmin[],
): Putusan {
  if (target.id === sayaId) {
    return {
      boleh: false,
      alasan: "Anda tidak bisa menonaktifkan akun Anda sendiri.",
    };
  }

  if (adminAktifTerakhir(target, semua)) {
    return {
      boleh: false,
      alasan:
        "Ini admin aktif terakhir. Menonaktifkannya akan mengunci semua orang dari menu administrasi.",
    };
  }

  return BOLEH;
}

export function bolehUbahRole(
  target: UserAdmin,
  sayaId: number,
  roleBaru: string,
  semua: UserAdmin[],
): Putusan {
  // Menurunkan role sendiri = kehilangan akses ke halaman ini seketika.
  if (target.id === sayaId && roleBaru !== target.role) {
    return {
      boleh: false,
      alasan: "Anda tidak bisa mengubah role akun Anda sendiri.",
    };
  }

  if (roleBaru !== "admin" && adminAktifTerakhir(target, semua)) {
    return {
      boleh: false,
      alasan:
        "Ini admin aktif terakhir. Menurunkan rolenya akan mengunci semua orang dari menu administrasi.",
    };
  }

  return BOLEH;
}

/** Backend menolak perubahan email — field-nya dikunci saat edit. */
export const EMAIL_BISA_DIUBAH = false;

export const PANJANG_PASSWORD_MINIMAL = 8;

export type GalatForm = Partial<
  Record<"email" | "password" | "role" | "outlet_code", string>
>;

/**
 * Validasi pembuatan user, mencerminkan aturan backend supaya pesannya
 * menempel di field, bukan datang sebagai 422 tanpa konteks (TODO 6.16).
 */
export function validasiUserBaru(input: {
  email: string;
  password: string;
  role: string;
  outlet_code?: string;
}): GalatForm {
  const galat: GalatForm = {};

  if (input.email.trim() === "") {
    galat.email = "Email wajib diisi.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    galat.email = "Format email tidak valid.";
  }

  if (input.password.length < PANJANG_PASSWORD_MINIMAL) {
    galat.password = `Kata sandi minimal ${PANJANG_PASSWORD_MINIMAL} karakter.`;
  }

  if (!["admin", "manager", "outlet"].includes(input.role)) {
    galat.role = "Pilih role yang tersedia.";
  }

  // Role `outlet` tanpa outlet tidak punya arti — backend menolaknya 422.
  if (input.role === "outlet" && !input.outlet_code?.trim()) {
    galat.outlet_code = "Role outlet wajib punya kode outlet.";
  }

  return galat;
}
