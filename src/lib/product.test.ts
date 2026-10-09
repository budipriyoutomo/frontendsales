import { describe, expect, it } from "vitest";
import {
  normalisasiKodeProduk,
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
  it("ProductID wajib dan maksimal 50 karakter setelah dinormalisasi", () => {
    expect(validasiKodeProduk("   ")).toBe("ProductID wajib diisi.");
    expect(validasiKodeProduk("X".repeat(51))).toMatch(/maksimal 50/);
    expect(validasiKodeProduk(` ${"X".repeat(50)} `)).toBeNull();
  });

  it("Product Code memakai aturan yang sama dengan labelnya sendiri", () => {
    expect(validasiKodeProduk("", "Product Code")).toBe(
      "Product Code wajib diisi.",
    );
    expect(validasiKodeProduk("sku-1", "Product Code")).toBeNull();
  });

  it("nama wajib", () => {
    expect(validasiNamaProduk("  ")).toMatch(/wajib/);
    expect(validasiNamaProduk("Red Plate")).toBeNull();
  });

  it("teks opsional boleh kosong tapi dibatasi panjangnya", () => {
    expect(validasiTeksOpsional("", "Subkategori", 100)).toBeNull();
    expect(validasiTeksOpsional("x".repeat(101), "Subkategori", 100)).toMatch(
      /Subkategori maksimal 100/,
    );
  });
});
