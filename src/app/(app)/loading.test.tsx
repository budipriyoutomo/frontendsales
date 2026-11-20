import { existsSync } from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import MemuatHalaman from "./loading";
import MemuatDashboard from "./dashboard/loading";

/**
 * Keadaan memuat saat pindah menu (`loading.tsx`).
 *
 * Tanpa file ini layar diam sampai render server selesai, jadi klik menu
 * terasa tidak ditanggapi.
 */

async function periksa(container: HTMLElement) {
  const hasil = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    rules: { region: { enabled: false } },
  });

  return hasil.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.length} elemen)`,
  );
}

const kasus = [
  { nama: "generik (app)", Komponen: MemuatHalaman },
  { nama: "dashboard", Komponen: MemuatDashboard },
] as const;

describe.each(kasus)("loading $nama", ({ Komponen }) => {
  it("mengumumkan dirinya sebagai status yang sedang sibuk", () => {
    render(<Komponen />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(within(status).getByText("Memuat…")).toBeInTheDocument();
  });

  it("teks 'Memuat…' hanya untuk pembaca layar, kerangkanya disembunyikan", () => {
    const { container } = render(<Komponen />);

    expect(screen.getByText("Memuat…")).toHaveClass("sr-only");

    const kerangka = container.querySelectorAll('[data-slot="skeleton"]');
    expect(kerangka.length).toBeGreaterThan(0);
    // Balok abu-abu tidak punya makna; pembaca layar cukup mendengar "Memuat…".
    for (const el of kerangka) {
      expect(el.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it("tidak menggambar ulang shell — sidebar & header milik layout", () => {
    render(<Komponen />);

    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("main")).toBeNull();
  });

  it("bebas pelanggaran WCAG A/AA", async () => {
    const { container } = render(<Komponen />);

    expect(await periksa(container)).toEqual([]);
  });
});

describe("bentuk kerangka dashboard", () => {
  it("memuat kartu ringkasan, grafik, dan tabel seperti halaman aslinya", () => {
    const { container } = render(<MemuatDashboard />);

    // Empat kartu ringkasan, dengan grid yang sama dengan SummaryCards.
    const ringkasan = container.querySelector('[data-kerangka="ringkasan"]');
    expect(ringkasan).toHaveClass("grid", "sm:grid-cols-2", "xl:grid-cols-4");
    expect(ringkasan?.children).toHaveLength(4);

    // Tinggi area grafik sama dengan ChartContainer DailyChart (h-64).
    const grafik = container.querySelector('[data-kerangka="grafik"]');
    expect(grafik?.querySelector(".h-64")).not.toBeNull();

    expect(container.querySelector('[data-kerangka="tabel"]')).not.toBeNull();
  });
});

describe("letak file", () => {
  it("loading.tsx berada di segmen yang sama dengan layout, jadi dibungkus olehnya", () => {
    // Next menaruh loading.tsx DI DALAM layout.tsx segmen yang sama — shell
    // (sidebar, header) tetap tampil. Kalau file ini dipindah ke atas
    // layout, shell ikut hilang saat memuat.
    const segmen = path.resolve(__dirname);
    expect(existsSync(path.join(segmen, "layout.tsx"))).toBe(true);
    expect(existsSync(path.join(segmen, "loading.tsx"))).toBe(true);
    expect(existsSync(path.join(segmen, "dashboard", "loading.tsx"))).toBe(
      true,
    );
  });
});
