import { describe, expect, it } from "vitest";
import {
  STATUS_PERBANDINGAN,
  STATUS_PESAN,
  formatJson,
  formatLokasiError,
  formatSelisih,
  hitungPerStatus,
  saringPerbandingan,
} from "@/lib/closing";
import type { ClosingComparisonRow } from "@/types/domain";

function baris(
  status: string,
  lain: Partial<ClosingComparisonRow> = {},
): ClosingComparisonRow {
  return {
    outlet_code: "STTSM",
    production_date: "2026-10-02",
    product_id: 900001,
    product_name: "RED",
    menus: [],
    closing_qty: 5,
    pos_qty: 5,
    selisih: 0,
    status,
    ...lain,
  };
}

describe("status perbandingan", () => {
  it("punya label untuk keempat status backend", () => {
    expect(Object.keys(STATUS_PERBANDINGAN).sort()).toEqual([
      "belum_dipetakan",
      "cocok",
      "selisih",
      "tidak_ada_di_closing",
    ]);
  });

  it("menghitung jumlah baris per status, status tanpa baris bernilai 0", () => {
    expect(
      hitungPerStatus([baris("cocok"), baris("selisih"), baris("selisih")]),
    ).toEqual({
      cocok: 1,
      selisih: 2,
      belum_dipetakan: 0,
      tidak_ada_di_closing: 0,
    });
  });

  it("status yang tidak dikenal tidak membuat hitungan rusak", () => {
    expect(hitungPerStatus([baris("baru_dari_backend")]).cocok).toBe(0);
  });
});

describe("saringPerbandingan", () => {
  const semua = [
    baris("cocok"),
    baris("selisih", { product_name: "BLUE" }),
    baris("belum_dipetakan", { product_name: null }),
  ];

  it("tanpa status mengembalikan semua", () => {
    expect(saringPerbandingan(semua, undefined)).toHaveLength(3);
  });

  it("menyaring per status", () => {
    expect(
      saringPerbandingan(semua, "selisih").map((b) => b.product_name),
    ).toEqual(["BLUE"]);
  });

  it("`bermasalah` = semua selain cocok", () => {
    expect(
      saringPerbandingan(semua, "bermasalah").map((b) => b.product_name),
    ).toEqual(["BLUE", null]);
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
