import { describe, expect, it } from "vitest";
import {
  bacaHarga,
  normalisasiKodeProduk,
  validasiHarga,
  validasiKodeProduk,
  validasiNamaProduk,
  validasiTeksOpsional,
} from "@/lib/product";

describe("normalisasiKodeProduk", () => {
  it("membuang spasi di ujung dan menjadikan huruf besar", () => {
    expect(normalisasiKodeProduk("  p-001 ")).toBe("P-001");
  });

  it("hanya spasi yang dibuang, sama dengan backend", () => {
    expect(normalisasiKodeProduk("\tp1")).toBe("\tP1");
  });
});

describe("validasi produk", () => {
  it("kode wajib dan maksimal 50 karakter setelah dinormalisasi", () => {
    expect(validasiKodeProduk("   ")).toMatch(/wajib/);
    expect(validasiKodeProduk("X".repeat(51))).toMatch(/maksimal 50/);
    expect(validasiKodeProduk(` ${"X".repeat(50)} `)).toBeNull();
  });

  it("nama wajib", () => {
    expect(validasiNamaProduk("  ")).toMatch(/wajib/);
    expect(validasiNamaProduk("Red Plate")).toBeNull();
  });

  it("teks opsional boleh kosong tapi dibatasi panjangnya", () => {
    expect(validasiTeksOpsional("", "Satuan", 20)).toBeNull();
    expect(validasiTeksOpsional("x".repeat(21), "Satuan", 20)).toMatch(
      /Satuan maksimal 20/,
    );
  });
});

describe("bacaHarga", () => {
  it.each([
    ["", 0],
    ["25000", 25000],
    [" 25000 ", 25000],
    ["0", 0],
  ])("%j → %j", (teks, hasil) => {
    expect(bacaHarga(teks)).toBe(hasil);
  });

  it.each(["-1", "25.000", "25,000", "25000.5", "1e3", "abc"])(
    "menolak %j",
    (teks) => {
      expect(bacaHarga(teks)).toBeNull();
      expect(validasiHarga(teks)).not.toBeNull();
    },
  );
});
