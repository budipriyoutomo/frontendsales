import { describe, expect, it } from "vitest";
import {
  formatAngka,
  formatDurasiTunggu,
  formatRupiah,
  formatTanggal,
  formatTanggalWaktu,
} from "@/lib/format";

describe("formatRupiah (0.4, 4.9)", () => {
  it("memformat omzet dengan pemisah ribuan id-ID", () => {
    expect(formatRupiah(4418375)).toBe("Rp 4.418.375");
  });

  it("tidak menampilkan angka desimal untuk rupiah", () => {
    expect(formatRupiah(315598.4)).toBe("Rp 315.598");
  });

  it("menampilkan nol sebagai nol, bukan tanda kosong", () => {
    expect(formatRupiah(0)).toBe("Rp 0");
  });

  it("memakai tanda kosong untuk nilai yang tidak ada (4.11)", () => {
    // Yang dijaga di sini: jangan sampai layar menampilkan "Rp NaN".
    expect(formatRupiah(null)).toBe("—");
    expect(formatRupiah(undefined)).toBe("—");
    expect(formatRupiah(Number.NaN)).toBe("—");
  });
});

describe("formatAngka", () => {
  it("memformat jumlah transaksi dengan pemisah ribuan", () => {
    expect(formatAngka(14)).toBe("14");
    expect(formatAngka(1234567)).toBe("1.234.567");
  });

  it("memakai tanda kosong untuk nilai yang tidak ada", () => {
    expect(formatAngka(null)).toBe("—");
    expect(formatAngka(Number.NaN)).toBe("—");
  });
});

describe("formatTanggal (0.4)", () => {
  it("memformat tanggal sebagai dd MMM yyyy", () => {
    expect(formatTanggal("2026-09-12")).toBe("12 Sep 2026");
  });

  it("menerima objek Date", () => {
    expect(formatTanggal(new Date("2026-01-05T00:00:00Z"))).toMatch(
      /05 Jan 2026/,
    );
  });

  it("tidak merender tanggal kosong untuk outlet yang belum pernah sync (7.5)", () => {
    expect(formatTanggal(null)).toBe("—");
    expect(formatTanggal("")).toBe("—");
    expect(formatTanggal("bukan-tanggal")).toBe("—");
  });
});

describe("formatTanggalWaktu", () => {
  it("menyertakan jam dan menit", () => {
    expect(formatTanggalWaktu("2026-09-12T14:30:00")).toMatch(
      /12 Sep 2026.*14[.:]30/,
    );
  });

  it("memakai tanda kosong untuk nilai yang tidak ada", () => {
    expect(formatTanggalWaktu(null)).toBe("—");
  });
});

describe("formatDurasiTunggu (2.6)", () => {
  it("menyebut detik untuk tunggu pendek", () => {
    expect(formatDurasiTunggu(45)).toBe("45 detik");
  });

  it("menyebut menit bulat tanpa sisa detik", () => {
    expect(formatDurasiTunggu(300)).toBe("5 menit");
    expect(formatDurasiTunggu(120)).toBe("2 menit");
  });

  it("menyebut menit dan detik saat ada sisa", () => {
    expect(formatDurasiTunggu(90)).toBe("1 menit 30 detik");
  });

  it("tidak pernah menampilkan angka negatif", () => {
    expect(formatDurasiTunggu(-5)).toBe("0 detik");
  });
});
