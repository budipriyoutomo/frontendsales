"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import type { Filter } from "@/lib/filter";
import type {
  ClosingComparisonRow,
  ClosingMenu,
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
    placeholderData: (sebelumnya) => sebelumnya,
    queryFn: () =>
      api.request<ClosingComparisonRow[]>("/api/closing-reports/comparison", {
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
    placeholderData: (sebelumnya) => sebelumnya,
    queryFn: () =>
      api.requestWithMeta<ClosingReportSummary[]>("/api/closing-reports", {
        query: { ...queryFilter(filter), limit: LIMIT_LAPORAN, offset },
      }),
  });
}

export function useClosingReport(closingReportId: string | null) {
  return useQuery({
    queryKey: ["closing-report", closingReportId],
    enabled: closingReportId !== null,
    queryFn: () =>
      api.request<ClosingReportDetail>(
        `/api/closing-reports/${closingReportId}`,
      ),
  });
}

export type StatusMenu = "all" | "mapped" | "unmapped";

export function useClosingMenus(status: StatusMenu, q: string) {
  return useQuery({
    queryKey: ["closing-menus", status, q],
    placeholderData: (sebelumnya) => sebelumnya,
    queryFn: () =>
      api.request<ClosingMenu[]>("/api/closing-menus", {
        query: { status, q: q || undefined },
      }),
  });
}
