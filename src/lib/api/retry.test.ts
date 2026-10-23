import { describe, expect, it } from "vitest";
import { ApiError, NetworkError } from "@/lib/api/client";
import { bolehDiulang } from "@/lib/api/retry";

const galat = (status: number) =>
  new ApiError({ status, message: `HTTP ${status}` });

describe("bolehDiulang — kebijakan retry TanStack Query", () => {
  it("4xx tidak diulang — hasilnya tidak akan berubah", () => {
    expect(bolehDiulang(0, galat(403))).toBe(false);
    expect(bolehDiulang(0, galat(422))).toBe(false);
  });

  it("500 dan 502 diulang sampai dua kali", () => {
    expect(bolehDiulang(0, galat(500))).toBe(true);
    expect(bolehDiulang(1, galat(502))).toBe(true);
    expect(bolehDiulang(2, galat(500))).toBe(false);
  });

  it("503 dan 504 tidak diulang — query berat yang diulang hanya menambah beban server", () => {
    expect(bolehDiulang(0, galat(503))).toBe(false);
    expect(bolehDiulang(0, galat(504))).toBe(false);
  });

  it("gangguan jaringan diulang", () => {
    expect(bolehDiulang(0, new NetworkError(new Error("putus")))).toBe(true);
  });
});
