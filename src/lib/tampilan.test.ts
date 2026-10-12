import { afterEach, describe, expect, it } from "vitest";
import {
  KUNCI_AKSEN,
  SKRIP_AKSEN,
  bacaAksenTerpasang,
  pasangAksen,
  simpanAksen,
} from "@/lib/tampilan";

const root = () => document.documentElement;

afterEach(() => {
  localStorage.clear();
  root().removeAttribute("data-accent");
});

describe("warna aksen", () => {
  it("netral tidak memasang atribut — token bawaan yang berlaku", () => {
    pasangAksen("merah", root());
    pasangAksen("netral", root());

    expect(root().hasAttribute("data-accent")).toBe(false);
    expect(bacaAksenTerpasang()).toBe("netral");
  });

  it("simpanAksen memasang atribut dan menyimpannya", () => {
    simpanAksen("hijau");

    expect(root().getAttribute("data-accent")).toBe("hijau");
    expect(localStorage.getItem(KUNCI_AKSEN)).toBe("hijau");
    expect(bacaAksenTerpasang()).toBe("hijau");
  });

  it("skrip <head> memasang aksen tersimpan sebelum render", () => {
    localStorage.setItem(KUNCI_AKSEN, "ungu");
    new Function(SKRIP_AKSEN)();

    expect(root().getAttribute("data-accent")).toBe("ungu");
  });

  it("skrip <head> mengabaikan nilai yang tidak dikenal", () => {
    // Nilai dari localStorage tidak boleh dipercaya begitu saja.
    localStorage.setItem(KUNCI_AKSEN, '"><img src=x>');
    new Function(SKRIP_AKSEN)();

    expect(root().hasAttribute("data-accent")).toBe(false);
  });
});
