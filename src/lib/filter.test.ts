import { describe, expect, it } from "vitest";
import {
  bacaFilter,
  filterKeQuery,
  filterKeSearchParams,
  rentangDefault,
} from "@/lib/filter";

const HARI_INI = new Date("2026-09-12T10:00:00");

describe("rentangDefault (4.1)", () => {
  it("memakai 30 hari terakhir termasuk hari ini", () => {
    expect(rentangDefault(HARI_INI)).toEqual({
      start_date: "2026-08-14",
      end_date: "2026-09-12",
    });
  });

  it("memakai tanggal lokal, bukan UTC", () => {
    // Jam 00:30 WIB masih 17:30 UTC hari sebelumnya — kalau dipotong dari
    // ISO string UTC, filter akan meleset satu hari.
    const dinihari = new Date(2026, 8, 12, 0, 30);
    expect(rentangDefault(dinihari).end_date).toBe("2026-09-12");
  });
});

describe("bacaFilter (4.8)", () => {
  it("membaca rentang dan outlet dari URL", () => {
    const f = bacaFilter(
      new URLSearchParams(
        "start_date=2026-01-01&end_date=2026-01-31&outlet=OUT1",
      ),
      HARI_INI,
    );

    expect(f).toEqual({
      start_date: "2026-01-01",
      end_date: "2026-01-31",
      outlet: "OUT1",
    });
  });

  it("jatuh ke rentang default saat URL kosong", () => {
    const f = bacaFilter(new URLSearchParams(), HARI_INI);

    expect(f.start_date).toBe("2026-08-14");
    expect(f.end_date).toBe("2026-09-12");
    expect(f.outlet).toBeUndefined();
  });

  it("mengabaikan tanggal yang bentuknya tidak sah", () => {
    const f = bacaFilter(
      new URLSearchParams("start_date=kemarin&end_date=2026-13-45"),
      HARI_INI,
    );

    expect(f.start_date).toBe("2026-08-14");
    expect(f.end_date).toBe("2026-09-12");
  });

  it("menukar rentang yang terbalik supaya tidak mengembalikan nol baris", () => {
    const f = bacaFilter(
      new URLSearchParams("start_date=2026-03-31&end_date=2026-03-01"),
      HARI_INI,
    );

    expect(f.start_date).toBe("2026-03-01");
    expect(f.end_date).toBe("2026-03-31");
  });

  it("memperlakukan outlet kosong sebagai semua outlet", () => {
    expect(bacaFilter(new URLSearchParams("outlet="), HARI_INI).outlet).toBe(
      undefined,
    );
  });
});

describe("filterKeSearchParams (4.8)", () => {
  it("menulis filter kembali ke URL supaya bisa dibagikan", () => {
    const params = filterKeSearchParams({
      start_date: "2026-01-01",
      end_date: "2026-01-31",
      outlet: "OUT1",
    });

    expect(params.toString()).toBe(
      "start_date=2026-01-01&end_date=2026-01-31&outlet=OUT1",
    );
  });

  it("tidak menulis outlet saat semua outlet dipilih", () => {
    const params = filterKeSearchParams({
      start_date: "2026-01-01",
      end_date: "2026-01-31",
    });

    expect(params.has("outlet")).toBe(false);
  });

  it("mempertahankan param lain di URL, mis. group terpilih (10.12)", () => {
    const params = filterKeSearchParams(
      { start_date: "2026-02-01", end_date: "2026-02-28" },
      new URLSearchParams(
        "start_date=2026-01-01&outlet=OUT1&product_group=A&product_group=B",
      ),
    );

    expect(params.get("start_date")).toBe("2026-02-01");
    expect(params.getAll("product_group")).toEqual(["A", "B"]);
    // Outlet milik filter, jadi "semua outlet" memang menghapusnya.
    expect(params.has("outlet")).toBe(false);
  });

  it("membuang offset — ganti filter berarti kembali ke halaman pertama", () => {
    // Halaman transaksi menyimpan nomor halaman di URL. Kalau offset ikut
    // terbawa, rentang tanggal baru dibuka di baris ke-101 dan tabelnya
    // tampak kosong padahal datanya ada.
    const params = filterKeSearchParams(
      { start_date: "2026-02-01", end_date: "2026-02-28" },
      new URLSearchParams("start_date=2026-01-01&offset=100"),
    );

    expect(params.has("offset")).toBe(false);
  });
});

describe("filterKeQuery", () => {
  it("menghasilkan param sesuai nama di kontrak API", () => {
    expect(
      filterKeQuery({
        start_date: "2026-01-01",
        end_date: "2026-01-31",
        outlet: "OUT1",
      }),
    ).toEqual({
      start_date: "2026-01-01",
      end_date: "2026-01-31",
      outlet: "OUT1",
    });
  });
});
