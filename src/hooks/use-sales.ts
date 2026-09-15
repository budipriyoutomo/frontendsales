"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import { filterKeQuery, type Filter } from "@/lib/filter";
import type {
  DailyRow,
  Outlet,
  OutletSalesRow,
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
    queryFn: () =>
      api.request<Summary>("/api/sales/summary", {
        query: filterKeQuery(filter),
      }),
  });
}

export function useDailySales(filter: Filter) {
  return useQuery({
    queryKey: kunci("daily", filter),
    queryFn: () =>
      api.request<DailyRow[]>("/api/sales/daily", {
        query: filterKeQuery(filter),
      }),
  });
}

export function useSalesByOutlet(filter: Filter, aktif: boolean) {
  return useQuery({
    queryKey: kunci("by-outlet", filter),
    // Hanya admin/manager yang boleh; untuk role outlet endpoint ini 403.
    enabled: aktif,
    queryFn: () =>
      api.request<OutletSalesRow[]>("/api/sales/by-outlet", {
        // Endpoint ini tidak menerima `outlet` — memang lintas outlet.
        query: {
          start_date: filter.start_date,
          end_date: filter.end_date,
        },
      }),
  });
}

export function useTopProducts(filter: Filter, limit = 10) {
  return useQuery({
    queryKey: [...kunci("top-products", filter), limit],
    queryFn: () =>
      api.request<TopProductRow[]>("/api/sales/top-products", {
        query: { ...filterKeQuery(filter), limit },
      }),
  });
}

export function useOutlets(aktif: boolean) {
  return useQuery({
    queryKey: ["outlets"],
    enabled: aktif,
    // Daftar outlet nyaris tidak pernah berubah dalam satu sesi.
    staleTime: 10 * 60_000,
    queryFn: () => api.request<Outlet[]>("/api/outlets"),
  });
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ["sync-status"],
    queryFn: () => api.request<SyncStatusRow[]>("/api/outlets/sync-status"),
    // Halaman ini soal "apakah POS masih mengirim data" — data basi di sini
    // justru menyembunyikan masalah yang ingin dilihat (TODO 7.3).
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
