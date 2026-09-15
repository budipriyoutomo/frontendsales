import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { namaFileDariHeader, unduhResponse } from "@/lib/download";

describe("namaFileDariHeader (5.4)", () => {
  it("membaca filename berkutip dari Content-Disposition", () => {
    expect(
      namaFileDariHeader('attachment; filename="sales_2026-09.csv"', "x.csv"),
    ).toBe("sales_2026-09.csv");
  });

  it("membaca filename tanpa kutip", () => {
    expect(namaFileDariHeader("attachment; filename=sales.csv", "x.csv")).toBe(
      "sales.csv",
    );
  });

  it("mengutamakan filename* (RFC 5987) dan mendekode persennya", () => {
    expect(
      namaFileDariHeader(
        "attachment; filename=\"fallback.csv\"; filename*=UTF-8''laporan%20penjualan.csv",
        "x.csv",
      ),
    ).toBe("laporan penjualan.csv");
  });

  it("memakai nama cadangan saat header tidak ada", () => {
    expect(namaFileDariHeader(null, "cadangan.csv")).toBe("cadangan.csv");
  });

  it("membuang path supaya server tidak bisa menentukan lokasi tulis", () => {
    expect(
      namaFileDariHeader('attachment; filename="../../etc/passwd"', "x.csv"),
    ).toBe("passwd");
  });
});

describe("unduhResponse (5.4, 5.9)", () => {
  const createObjectURL = vi.fn(() => "blob:palsu");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("memicu unduhan lewat anchor, bukan menampilkan CSV di layar", async () => {
    const klik = vi.fn();
    const anchorAsli = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = anchorAsli(tag) as HTMLElement;
      if (tag === "a") el.click = klik;
      return el;
    });

    const response = new Response("a,b\n1,2", {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="sales.csv"',
      },
    });

    await unduhResponse(response, "cadangan.csv");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(klik).toHaveBeenCalledTimes(1);
    // URL objek dilepas lagi supaya blob tidak menggantung di memori.
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:palsu");
    expect(document.body.textContent).not.toContain("a,b");

    vi.mocked(document.createElement).mockRestore();
  });
});
