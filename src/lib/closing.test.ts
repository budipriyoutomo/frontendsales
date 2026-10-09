import { describe, expect, it } from "vitest";
import {
  STATUS_PESAN,
  formatJson,
  formatLokasiError,
  formatSelisih,
  totalBaris,
} from "@/lib/closing";
import type { ClosingComparisonRow } from "@/types/domain";

function baris(lain: Partial<ClosingComparisonRow>): ClosingComparisonRow {
  return {
    outlet_code: "STTSM",
    production_date: "2026-10-02",
    menu_id: "0a1b2c3d-4e5f-4a7b-8c9d-0e1f2a3b4c5d",
    menu_name: "Salmon Nigiri",
    sold: null,
    waste: null,
    adjustment: null,
    compensation: null,
    products: [],
    pos_qty: null,
    ...lain,
  };
}

describe("totalBaris", () => {
  it("Total Sold = Colorplate terjual + qty POS; sisanya dari Colorplate", () => {
    expect(
      totalBaris(
        baris({
          sold: 42,
          waste: 3,
          adjustment: -2,
          compensation: 7,
          pos_qty: 31,
        }),
      ),
    ).toEqual({ sold: 73, waste: 3, adjustment: -2, compensation: 7 });
  });

  it("menu belum dipetakan: qty POS kosong dihitung 0", () => {
    expect(
      totalBaris(baris({ sold: 5, waste: 1, adjustment: 0, compensation: 0 }))
        .sold,
    ).toBe(5);
  });

  it("baris hanya POS: angka Colorplate kosong dihitung 0", () => {
    expect(totalBaris(baris({ menu_id: null, pos_qty: 12 }))).toEqual({
      sold: 12,
      waste: 0,
      adjustment: 0,
      compensation: 0,
    });
  });
});

describe("formatSelisih", () => {
  it.each([
    [null, "—"],
    [undefined, "—"],
    [0, "0"],
    [2, "+2"],
    [-15, "−15"],
    [1.5, "+1,5"],
  ])("%s → %s", (nilai, hasil) => {
    expect(formatSelisih(nilai)).toBe(hasil);
  });
});

describe("STATUS_PESAN", () => {
  it("memberi label untuk setiap status log pesan backend", () => {
    expect(Object.keys(STATUS_PESAN).sort()).toEqual(
      ["baru", "ditolak", "duplikat", "revisi", "revisi_lama"].sort(),
    );
    expect(STATUS_PESAN.ditolak.nada).toBe("buruk");
  });
});

describe("formatLokasiError", () => {
  it("menulis lokasi error validasi seperti jalur JSON", () => {
    expect(formatLokasiError(["data", "items", 0, "sold"])).toBe(
      "data.items[0].sold",
    );
    expect(formatLokasiError(["version"])).toBe("version");
  });

  it("lokasi kosong atau tidak dikenal", () => {
    expect(formatLokasiError([])).toBe("(pesan)");
    expect(formatLokasiError(undefined)).toBe("(pesan)");
    expect(formatLokasiError("x")).toBe("(pesan)");
  });
});

describe("formatJson", () => {
  it("rapi dengan indentasi 2 spasi", () => {
    expect(formatJson({ a: [1] })).toBe('{\n  "a": [\n    1\n  ]\n}');
  });
});
