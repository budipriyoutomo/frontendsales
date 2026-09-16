import { describe, expect, it } from "vitest";
import {
  NAV,
  bolehLihatPemilihOutlet,
  bolehMasukHalaman,
  navUntukRole,
} from "@/lib/auth/access";
import type { Role } from "@/lib/auth/current-user";

const label = (role: Role) => navUntukRole(role).map((n) => n.label);

describe("navUntukRole (3.2, 3.7)", () => {
  it("admin melihat seluruh menu", () => {
    expect(label("admin")).toEqual(NAV.map((n) => n.label));
  });

  it("manager tidak melihat menu API key dan pengguna (3.7)", () => {
    const menu = label("manager");

    expect(menu).not.toContain("API Key");
    expect(menu).not.toContain("Pengguna");
    expect(menu).not.toContain("Product Group");
    // Tapi tetap melihat yang memang haknya.
    expect(menu).toContain("Dashboard");
    expect(menu).toContain("Transaksi");
    expect(menu).toContain("Status Sync");
  });

  it("role outlet hanya melihat menu yang boleh diaksesnya", () => {
    const menu = label("outlet");

    expect(menu).toEqual(["Dashboard", "Transaksi", "Status Sync"]);
  });
});

describe("bolehMasukHalaman (3.3, 3.9)", () => {
  it("menolak manager membuka halaman pengguna (3.9)", () => {
    expect(bolehMasukHalaman("manager", "/pengguna")).toBe(false);
    expect(bolehMasukHalaman("manager", "/api-keys")).toBe(false);
  });

  it("menolak role outlet membuka halaman khusus admin", () => {
    expect(bolehMasukHalaman("outlet", "/pengguna")).toBe(false);
    expect(bolehMasukHalaman("outlet", "/api-keys")).toBe(false);
  });

  it("halaman product group khusus admin (10.4, 10.16)", () => {
    expect(bolehMasukHalaman("admin", "/product-group")).toBe(true);
    expect(bolehMasukHalaman("manager", "/product-group")).toBe(false);
    expect(bolehMasukHalaman("outlet", "/product-group")).toBe(false);
  });

  it("mengizinkan admin ke mana saja", () => {
    for (const item of NAV) {
      expect(bolehMasukHalaman("admin", item.href)).toBe(true);
    }
  });

  it("mengizinkan semua role membuka dashboard dan transaksi", () => {
    for (const role of ["admin", "manager", "outlet"] as Role[]) {
      expect(bolehMasukHalaman(role, "/dashboard")).toBe(true);
      expect(bolehMasukHalaman(role, "/transaksi")).toBe(true);
    }
  });

  it("mengenali sub-path, bukan hanya kecocokan persis", () => {
    // Detail transaksi ada di /transaksi/<id>.
    expect(bolehMasukHalaman("outlet", "/transaksi/T-123")).toBe(true);
    expect(bolehMasukHalaman("manager", "/pengguna/4")).toBe(false);
  });
});

describe("bolehLihatPemilihOutlet (3.8)", () => {
  it("role outlet tidak melihat pemilih outlet", () => {
    // Bukan demi keamanan — server mengabaikan `?outlet=` untuk role ini —
    // tapi supaya filter yang tidak berefek tidak membingungkan.
    expect(bolehLihatPemilihOutlet("outlet")).toBe(false);
  });

  it("admin dan manager melihat pemilih outlet", () => {
    expect(bolehLihatPemilihOutlet("admin")).toBe(true);
    expect(bolehLihatPemilihOutlet("manager")).toBe(true);
  });
});
