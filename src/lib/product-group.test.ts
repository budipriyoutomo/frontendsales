import { describe, expect, it } from "vitest";
import {
  PANJANG_GROUP_MAKSIMAL,
  bacaGroupTerpilih,
  gantiParam,
  normalisasiGroup,
  saranGroup,
  validasiNamaGroup,
} from "@/lib/product-group";

function mapping(product_group: string, is_active = true) {
  return { id: 1, product_group, is_active };
}

describe("normalisasiGroup (10.6)", () => {
  it("membuang spasi di ujung dan menjadikan huruf besar", () => {
    expect(normalisasiGroup(" colorplate ")).toBe("COLORPLATE");
  });

  it("mempertahankan spasi di tengah nama", () => {
    expect(normalisasiGroup("promo  bandung")).toBe("PROMO  BANDUNG");
  });

  it("hanya membuang spasi, bukan tab — sama persis dengan backend", () => {
    // Backend memakai `strip(" ")` supaya cocok dengan `UPPER(TRIM("Group"))`
    // di SQL. Pratinjau yang lebih rajin membuang whitespace akan menjanjikan
    // nama yang tidak akan pernah tersimpan.
    expect(normalisasiGroup("\tminuman ")).toBe("\tMINUMAN");
  });
});

describe("validasiNamaGroup (10.6)", () => {
  it("menolak nama kosong atau spasi saja", () => {
    expect(validasiNamaGroup("")).toMatch(/wajib/i);
    expect(validasiNamaGroup("    ")).toMatch(/wajib/i);
  });

  it("menolak nama yang melebihi batas kolom", () => {
    const panjang = "A".repeat(PANJANG_GROUP_MAKSIMAL + 1);
    expect(validasiNamaGroup(panjang)).toMatch(/255/);
  });

  it("menghitung panjang setelah spasi di ujung dibuang", () => {
    const pas = ` ${"A".repeat(PANJANG_GROUP_MAKSIMAL)} `;
    expect(validasiNamaGroup(pas)).toBeNull();
  });
});

describe("saranGroup (10.6)", () => {
  it("menyarankan group di data penjualan yang belum dipetakan", () => {
    const hasil = saranGroup(
      ["COLORPLATE", "MINUMAN", "MAKANAN"],
      [mapping("COLORPLATE")],
    );

    expect(hasil).toEqual(["MAKANAN", "MINUMAN"]);
  });

  it("tidak menyarankan group yang sudah terdaftar walau sedang nonaktif", () => {
    // Menambahkannya lagi pasti 409 — yang benar adalah mengaktifkan.
    expect(saranGroup(["MINUMAN"], [mapping("MINUMAN", false)])).toEqual([]);
  });

  it("membandingkan dalam bentuk normal dan membuang duplikat", () => {
    const hasil = saranGroup(
      [" promo bandung", "PROMO BANDUNG ", "colorplate", ""],
      [mapping("COLORPLATE")],
    );

    expect(hasil).toEqual(["PROMO BANDUNG"]);
  });
});

describe("bacaGroupTerpilih (10.12)", () => {
  it("membaca param berulang dari URL", () => {
    const params = new URLSearchParams(
      "product_group=COLORPLATE&product_group=MINUMAN",
    );

    expect(bacaGroupTerpilih(params)).toEqual(["COLORPLATE", "MINUMAN"]);
  });

  it("menormalisasi, membuang yang kosong, dan membuang duplikat", () => {
    const params = new URLSearchParams(
      "product_group=colorplate&product_group=&product_group=COLORPLATE",
    );

    expect(bacaGroupTerpilih(params)).toEqual(["COLORPLATE"]);
  });

  it("mengembalikan daftar kosong saat tidak ada group di URL", () => {
    expect(bacaGroupTerpilih(new URLSearchParams())).toEqual([]);
  });
});

describe("gantiParam (10.12)", () => {
  it("menulis beberapa nilai sebagai param berulang", () => {
    const hasil = gantiParam(
      new URLSearchParams("start_date=2026-01-01"),
      "product_group",
      ["A", "B"],
    );

    expect(hasil.toString()).toBe(
      "start_date=2026-01-01&product_group=A&product_group=B",
    );
  });

  it("mengganti nilai lama, bukan menambahkannya", () => {
    const hasil = gantiParam(
      new URLSearchParams("product_group=LAMA&outlet=OUT1"),
      "product_group",
      ["BARU"],
    );

    expect(hasil.getAll("product_group")).toEqual(["BARU"]);
    expect(hasil.get("outlet")).toBe("OUT1");
  });

  it("menghapus param saat nilainya kosong", () => {
    const hasil = gantiParam(
      new URLSearchParams("top_product_group=A&outlet=OUT1"),
      "top_product_group",
      [],
    );

    expect(hasil.toString()).toBe("outlet=OUT1");
  });

  it("tidak mengubah params asal", () => {
    const asal = new URLSearchParams("product_group=A");
    gantiParam(asal, "product_group", ["B"]);

    expect(asal.toString()).toBe("product_group=A");
  });
});
