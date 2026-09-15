import { describe, expect, it } from "vitest";
import {
  AMBANG_BASI_JAM,
  AMBANG_WASPADA_JAM,
  labelKesegaran,
  nilaiKesegaran,
} from "@/lib/sync-status";

const SEKARANG = new Date("2026-09-12T12:00:00");

function baris(last_synced_at: string | null) {
  return {
    outlet_code: "OUT1",
    last_sale_date: "2026-09-12",
    last_synced_at,
    total_transactions: 10,
  };
}

/** `n` jam sebelum SEKARANG, dalam ISO lokal. */
function jamLalu(n: number): string {
  return new Date(SEKARANG.getTime() - n * 3600_000).toISOString();
}

describe("nilaiKesegaran (7.2)", () => {
  it("menyebut outlet yang baru saja sync sebagai segar", () => {
    expect(nilaiKesegaran(baris(jamLalu(1)), SEKARANG)).toBe("segar");
  });

  it("menyebut outlet yang diam beberapa jam sebagai waspada", () => {
    expect(
      nilaiKesegaran(baris(jamLalu(AMBANG_WASPADA_JAM + 1)), SEKARANG),
    ).toBe("waspada");
  });

  it("menyebut outlet yang diam lebih dari sehari sebagai basi", () => {
    expect(nilaiKesegaran(baris(jamLalu(AMBANG_BASI_JAM + 1)), SEKARANG)).toBe(
      "basi",
    );
  });

  it("membedakan outlet yang belum pernah sync dari yang basi (7.5)", () => {
    // Bedanya penting: outlet baru bukan outlet bermasalah.
    expect(nilaiKesegaran(baris(null), SEKARANG)).toBe("belum-pernah");
  });

  it("memperlakukan tanggal yang tidak bisa dibaca sebagai belum pernah", () => {
    expect(nilaiKesegaran(baris("bukan-tanggal"), SEKARANG)).toBe(
      "belum-pernah",
    );
  });

  it("tepat di ambang masih dihitung aman", () => {
    expect(nilaiKesegaran(baris(jamLalu(AMBANG_WASPADA_JAM)), SEKARANG)).toBe(
      "segar",
    );
    expect(nilaiKesegaran(baris(jamLalu(AMBANG_BASI_JAM)), SEKARANG)).toBe(
      "waspada",
    );
  });

  it("tidak menganggap waktu sync di masa depan sebagai basi", () => {
    // Jam POS yang meleset ke depan tidak boleh memunculkan alarm palsu.
    const depan = new Date(SEKARANG.getTime() + 3600_000).toISOString();
    expect(nilaiKesegaran(baris(depan), SEKARANG)).toBe("segar");
  });
});

describe("labelKesegaran", () => {
  it("memberi teks, bukan hanya warna", () => {
    expect(labelKesegaran("segar")).toMatch(/normal/i);
    expect(labelKesegaran("waspada")).toMatch(/perlu dicek|waspada/i);
    expect(labelKesegaran("basi")).toMatch(/tidak mengirim|basi/i);
    expect(labelKesegaran("belum-pernah")).toMatch(/belum pernah/i);
  });
});
