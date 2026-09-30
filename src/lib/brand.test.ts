import { describe, expect, it } from "vitest";
import {
  normalisasiKodeBrand,
  validasiKodeBrand,
  validasiNamaBrand,
} from "@/lib/brand";

describe("kode brand", () => {
  it("dinormalisasi seperti backend: spasi di ujung dibuang, huruf besar", () => {
    expect(normalisasiKodeBrand("  mhr ")).toBe("MHR");
    // Hanya spasi — tab tidak dibuang, sama dengan `strip(" ")`.
    expect(normalisasiKodeBrand("\tmhr")).toBe("\tMHR");
  });

  it("wajib diisi dan maksimal 20 karakter", () => {
    expect(validasiKodeBrand("   ")).toMatch(/wajib/);
    expect(validasiKodeBrand("X".repeat(21))).toMatch(/maksimal 20/);
    expect(validasiKodeBrand(" mhr ")).toBeNull();
  });
});

describe("nama brand", () => {
  it("wajib diisi", () => {
    expect(validasiNamaBrand("  ")).toMatch(/wajib/);
    expect(validasiNamaBrand("Maharasa")).toBeNull();
  });
});
