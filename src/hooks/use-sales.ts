"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import { filterKeQuery, type Filter } from "@/lib/filter";
import type {
  Brand,
  DailyRow,
  Outlet,
  OutletSalesRow,
  ProductGroupSalesRow,
  Summary,
  SyncStatusRow,
  TopProductRow,
} from "@/types/domain";

/**
 * Hook data dashboard (TODO 1.7, Fase 4).
 *
 * Semua request pergi ke Route Handler Next, bukan langsung ke FastAPI —
 * token ada di cookie httpOnly dan tidak boleh dipegang browser (0.2).
 */

/** Kunci cache disusun dari filter, jadi ganti rentang = query baru (4.10). */
const kunci = (nama: string, filter: Filter) => [nama, filterKeQuery(filter)];

export function useSummary(filter: Filter) {
  return useQuery({
    queryKey: kunci("summary", filter),
    queryFn: ({ signal }) =>
      api.request<Summary>("/api/sales/summary", {
        signal,
        query: filterKeQuery(filter),
      }),
  });
}

export function useDailySales(filter: Filter) {
  return useQuery({
    queryKey: kunci("daily", filter),
    queryFn: ({ signal }) =>
      api.request<DailyRow[]>("/api/sales/daily", {
        signal,
        query: filterKeQuery(filter),
      }),
  });
}

export function useSalesByOutlet(filter: Filter, aktif: boolean) {
  return useQuery({
    queryKey: kunci("by-outlet", filter),
    // Hanya admin/manager yang boleh; untuk role outlet endpoint ini 403.
    enabled: aktif,
    queryFn: ({ signal }) =>
      api.request<OutletSalesRow[]>("/api/sales/by-outlet", {
        signal,
        // Endpoint ini tidak menerima `outlet` — memang lintas outlet —
        // tapi bisa dipersempit ke outlet satu brand.
        query: {
          start_date: filter.start_date,
          end_date: filter.end_date,
          brand: filter.brand,
        },
      }),
  });
}

export function useTopProducts(filter: Filter, limit = 10, group?: string) {
  return useQuery({
    queryKey: [...kunci("top-products", filter), limit, group ?? ""],
    queryFn: ({ signal }) =>
      api.request<TopProductRow[]>("/api/sales/top-products", {
        signal,
        // Endpoint ini hanya menerima SATU group, beda dengan by-group (10.11).
        query: { ...filterKeQuery(filter), limit, product_group: group },
      }),
  });
}

/**
 * Group yang ADA di data penjualan (10.9) — bukan daftar yang dipublish
 * (`/api/product-groups`). Untuk role outlet, server mengabaikan `outlet`.
 *
 * Dashboard mengirim `rentang` filternya: tanpa rentang, backend memindai
 * seluruh data penjualan. Halaman admin sengaja tanpa rentang — perlu semua
 * group untuk menemukan yang belum dipetakan.
 */
export function useSalesProductGroups(
  outlet?: string,
  rentang?: Pick<Filter, "start_date" | "end_date">,
) {
  return useQuery({
    queryKey: [
      "sales-product-groups",
      outlet ?? "",
      rentang?.start_date ?? "",
      rentang?.end_date ?? "",
    ],
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) =>
      api.request<string[]>("/api/sales/product-groups", {
        signal,
        query: {
          outlet,
          start_date: rentang?.start_date,
          end_date: rentang?.end_date,
        },
      }),
  });
}

export function useSalesByGroup(filter: Filter, groups: readonly string[]) {
  return useQuery({
    queryKey: [...kunci("by-group", filter), groups],
    // `product_group` wajib di backend — tanpa group, request pasti 422.
    enabled: groups.length > 0,
    queryFn: ({ signal }) =>
      api.request<ProductGroupSalesRow[]>("/api/sales/by-group", {
        signal,
        // Array → param berulang; beberapa group TIDAK dipisah koma (10.10).
        query: { ...filterKeQuery(filter), product_group: groups },
      }),
  });
}

export function useOutlets(aktif: boolean) {
  return useQuery({
    queryKey: ["outlets"],
    enabled: aktif,
    // Daftar outlet nyaris tidak pernah berubah dalam satu sesi.
    staleTime: 10 * 60_000,
    queryFn: ({ signal }) => api.request<Outlet[]>("/api/outlets", { signal }),
  });
}

/** Brand untuk filter — admin & manager saja; role outlet mendapat 403. */
export function useBrands(aktif: boolean) {
  return useQuery({
    queryKey: ["brands"],
    enabled: aktif,
    staleTime: 10 * 60_000,
    queryFn: ({ signal }) => api.request<Brand[]>("/api/brands", { signal }),
  });
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ["sync-status"],
    queryFn: ({ signal }) =>
      api.request<SyncStatusRow[]>("/api/outlets/sync-status", { signal }),
    // Halaman ini soal "apakah POS masih mengirim data" — data basi di sini
    // justru menyembunyikan masalah yang ingin dilihat (TODO 7.3).
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
