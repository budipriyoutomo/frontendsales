import { describe, expect, it } from "vitest";
import {
  STATUS_PESAN,
  formatJson,
  formatLokasiError,
  formatSelisih,
} from "@/lib/closing";

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
