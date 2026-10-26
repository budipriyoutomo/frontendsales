"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import type { StatusPesan } from "@/lib/closing";
import type { Filter } from "@/lib/filter";
import type {
  ClosingComparisonRow,
  ClosingExportDetail,
  ClosingExportStatus,
  ClosingExportSummary,
  ClosingMenu,
  ClosingMessageCounts,
  ClosingMessageDetail,
  ClosingMessageSummary,
  ClosingReportDetail,
  ClosingReportSummary,
} from "@/types/domain";

/**
 * Hook closing report dari RabbitMQ (backend TODO Fase 7.6).
 *
 * Endpoint closing hanya menerima outlet + rentang tanggal — tidak ada
 * `brand`, jadi filter itu sengaja tidak dikirim. Untuk role outlet, server
 * mengabaikan `outlet` dan memakai outlet dari identitas.
 */

/** Sama dengan default backend; maksimumnya 200. */
export const LIMIT_LAPORAN = 50;

function queryFilter(filter: Filter) {
  return {
    outlet: filter.outlet,
    start_date: filter.start_date,
    end_date: filter.end_date,
  };
}

export function useClosingComparison(filter: Filter, includeDeleted: boolean) {
  return useQuery({
    queryKey: ["closing-comparison", queryFilter(filter), includeDeleted],
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      api.request<ClosingComparisonRow[]>("/api/closing-reports/comparison", {
        signal,
        query: {
          ...queryFilter(filter),
          include_deleted: includeDeleted || undefined,
        },
      }),
  });
}

export function useClosingReports(filter: Filter, offset: number) {
  return useQuery({
    queryKey: ["closing-reports", queryFilter(filter), offset],
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      api.requestWithMeta<ClosingReportSummary[]>("/api/closing-reports", {
        signal,
        query: { ...queryFilter(filter), limit: LIMIT_LAPORAN, offset },
      }),
  });
}

export function useClosingReport(closingReportId: string | null) {
  return useQuery({
    queryKey: ["closing-report", closingReportId],
    enabled: closingReportId !== null,
    queryFn: ({ signal }) =>
      api.request<ClosingReportDetail>(
        `/api/closing-reports/${closingReportId}`,
        { signal },
      ),
  });
}

export type StatusMenu = "all" | "mapped" | "unmapped";

export function useClosingMenus(status: StatusMenu, q: string, offset: number) {
  return useQuery({
    queryKey: ["closing-menus", "list", status, q, offset],
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      api.requestWithMeta<ClosingMenu[]>("/api/closing-menus", {
        signal,
        query: { status, q: q || undefined, limit: LIMIT_LAPORAN, offset },
      }),
  });
}

/** Satu menu — dialog mapping tidak bergantung pada halaman daftar yang termuat. */
export function useClosingMenu(menuId: number | null) {
  return useQuery({
    queryKey: ["closing-menus", "detail", menuId],
    enabled: menuId !== null,
    queryFn: ({ signal }) =>
      api.request<ClosingMenu>(`/api/closing-menus/${menuId}`, { signal }),
  });
}

export type FilterPesan = {
  status?: StatusPesan;
  q?: string;
  start_date?: string;
  end_date?: string;
};

export function useClosingMessages(filter: FilterPesan, offset: number) {
  return useQuery({
    queryKey: ["closing-messages", filter, offset],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const hasil = await api.requestWithMeta<ClosingMessageSummary[]>(
        "/api/closing-messages",
        {
          signal,
          query: {
            status: filter.status,
            q: filter.q || undefined,
            start_date: filter.start_date || undefined,
            end_date: filter.end_date || undefined,
            limit: LIMIT_LAPORAN,
            offset,
          },
        },
      );
      return {
        ...hasil,
        counts: (hasil.body as { counts?: ClosingMessageCounts }).counts,
      };
    },
  });
}

export function useClosingMessage(id: number | null) {
  return useQuery({
    queryKey: ["closing-message", id],
    enabled: id !== null,
    queryFn: ({ signal }) =>
      api.request<ClosingMessageDetail>(`/api/closing-messages/${id}`, {
        signal,
      }),
  });
}

/**
 * Kirim rekap closing ke API eksternal (backend Fase 8, admin saja). Filter
 * tanggal = tanggal produksi.
 */
export function useClosingExportStatus(filter: Filter) {
  return useQuery({
    queryKey: ["closing-export-status", queryFilter(filter)],
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      api.request<ClosingExportStatus[]>("/api/closing-exports/status", {
        signal,
        query: queryFilter(filter),
      }),
  });
}

export function useClosingExports(filter: Filter, offset: number) {
  return useQuery({
    queryKey: ["closing-exports", queryFilter(filter), offset],
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      api.requestWithMeta<ClosingExportSummary[]>("/api/closing-exports", {
        signal,
        query: { ...queryFilter(filter), limit: LIMIT_LAPORAN, offset },
      }),
  });
}

export function useClosingExport(id: number | null) {
  return useQuery({
    queryKey: ["closing-export", id],
    enabled: id !== null,
    queryFn: ({ signal }) =>
      api.request<ClosingExportDetail>(`/api/closing-exports/${id}`, {
        signal,
      }),
  });
}

function useSegarkanKiriman() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["closing-export-status"] }),
      qc.invalidateQueries({ queryKey: ["closing-exports"] }),
      qc.invalidateQueries({ queryKey: ["closing-export"] }),
    ]);
}

/**
 * Kiriman yang gagal di API tujuan tetap sukses di sisi backend (201,
 * `status: gagal`) — pemanggil memeriksa `status` hasilnya.
 */
export function useKirimClosing() {
  const segarkan = useSegarkanKiriman();
  return useMutation({
    mutationFn: (body: { outlet_code: string; production_date: string }) =>
      api.request<ClosingExportDetail>("/api/closing-exports", {
        method: "POST",
        body,
      }),
    onSettled: () => segarkan(),
  });
}

export function useUlangiKirimClosing() {
  const segarkan = useSegarkanKiriman();
  return useMutation({
    mutationFn: (id: number) =>
      api.request<ClosingExportDetail>(`/api/closing-exports/${id}/retry`, {
        method: "POST",
      }),
    onSettled: () => segarkan(),
  });
}
