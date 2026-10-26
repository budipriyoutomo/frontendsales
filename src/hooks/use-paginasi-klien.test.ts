import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePaginasiKlien } from "@/hooks/use-paginasi-klien";

const angka = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("usePaginasiKlien", () => {
  it("memotong daftar per halaman dan menghitung has_more", () => {
    const { result } = renderHook(() => usePaginasiKlien(angka(5), 2));

    expect(result.current.halaman).toEqual([1, 2]);
    expect(result.current.pagination).toEqual({ total: 5, has_more: true });

    act(() => result.current.setOffset(4));

    expect(result.current.halaman).toEqual([5]);
    expect(result.current.pagination).toEqual({ total: 5, has_more: false });
  });

  it("daftar menyusut tidak meninggalkan halaman kosong", () => {
    const { result, rerender } = renderHook(
      ({ data }) => usePaginasiKlien(data, 2),
      { initialProps: { data: angka(5) } },
    );
    act(() => result.current.setOffset(4));

    rerender({ data: angka(3) });

    expect(result.current.offset).toBe(2);
    expect(result.current.halaman).toEqual([3]);
  });

  it("daftar kosong", () => {
    const { result } = renderHook(() => usePaginasiKlien([], 2));

    expect(result.current.halaman).toEqual([]);
    expect(result.current.offset).toBe(0);
    expect(result.current.pagination).toEqual({ total: 0, has_more: false });
  });
});
