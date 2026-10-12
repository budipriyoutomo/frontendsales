import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { ThemeProvider } from "next-themes";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PengaturanView } from "@/components/tampilan/pengaturan-view";

// jsdom tidak punya matchMedia; next-themes memakainya untuk "Ikuti sistem".
beforeAll(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function tampilkan() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <PengaturanView />
    </ThemeProvider>,
  );
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-accent");
  document.documentElement.className = "";
});

describe("PengaturanView", () => {
  it("memilih warna aksen langsung memasangnya di <html>", async () => {
    const user = userEvent.setup();
    tampilkan();

    expect(screen.getByRole("radio", { name: "Netral" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Merah bata" }));

    expect(screen.getByRole("radio", { name: "Merah bata" })).toBeChecked();
    expect(document.documentElement.getAttribute("data-accent")).toBe("merah");
  });

  it("memilih tema gelap memasang kelas .dark", async () => {
    const user = userEvent.setup();
    tampilkan();

    await user.click(screen.getByRole("radio", { name: "Gelap" }));

    expect(screen.getByRole("radio", { name: "Gelap" })).toBeChecked();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("lolos pemeriksaan aksesibilitas dasar", async () => {
    const { container } = tampilkan();
    const hasil = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
      // jsdom tidak menghitung warna sungguhan.
      rules: { "color-contrast": { enabled: false } },
    });

    expect(hasil.violations).toEqual([]);
  });
});
