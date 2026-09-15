import { describe, expect, it } from "vitest";
import { transaksiVoid } from "@/lib/transaksi";
import type { Sale } from "@/types/domain";

function sale(extra: Partial<Sale> = {}): Sale {
  return {
    transaction_id: 1,
    outlet_code: "OUTLET_001",
    shop_id: 1,
    receipt_id: 1,
    reference_no: "REF-0001",
    sale_date: "2026-09-12",
    paid_time: "2026-09-12T10:00:00",
    receipt_total_amount: 3,
    receipt_pay_price: 150000,
    receipt_discount: 0,
    transaction_status_id: 2,
    void_staff_id: 0,
    deleted: 0,
    created_at: null,
    updated_at: null,
    ...extra,
  } as Sale;
}

describe("transaksiVoid (5.5)", () => {
  it("menandai transaksi dengan deleted = 1 sebagai void", () => {
    expect(transaksiVoid(sale({ deleted: 1 }))).toBe(true);
  });

  it("tidak menandai transaksi normal", () => {
    expect(transaksiVoid(sale())).toBe(false);
  });

  it("memakai kolom `deleted`, bukan `void_staff_id`", () => {
    // Keduanya kolom berbeda dengan arti berbeda. `Deleted` yang menentukan
    // apakah struk dibatalkan — dan itu pula yang dipakai endpoint laporan
    // untuk mengecualikan baris. Menebak lewat `void_staff_id` membuat tabel
    // dan kartu ringkasan bisa tidak sepakat.
    expect(transaksiVoid(sale({ deleted: 1, void_staff_id: 0 }))).toBe(true);
    expect(transaksiVoid(sale({ deleted: 0, void_staff_id: 7 }))).toBe(false);
  });

  it("memperlakukan deleted yang tidak ada sebagai tidak void", () => {
    // Response dari backend versi lama tidak membawa kolom ini.
    const tanpaField = sale();
    delete (tanpaField as Partial<Sale>).deleted;

    expect(transaksiVoid(tanpaField)).toBe(false);
  });
});
