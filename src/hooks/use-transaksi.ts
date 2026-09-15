"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import { filterKeQuery, type Filter } from "@/lib/filter";
import type { Pagination, Sale, SaleDetail } from "@/types/domain";

/** Backend menolak `limit` di atas 500; 50 adalah defaultnya (TODO 5.1). */
export const LIMIT_DEFAULT = 50;
export const LIMIT_MAKS = 500;

export function useSalesList(
  filter: Filter,
  offset: number,
  limit = LIMIT_DEFAULT,
) {
  return useQuery({
    queryKey: ["sales", filterKeQuery(filter), offset, limit],
    // Halaman lama ditahan saat pindah halaman supaya tabel tidak berkedip
    // kosong lalu terisi lagi.
    placeholderData: (sebelumnya) => sebelumnya,
    queryFn: () =>
      api.requestWithMeta<Sale[]>("/api/sales", {
        query: {
          ...filterKeQuery(filter),
          limit: Math.min(limit, LIMIT_MAKS),
          offset,
        },
      }),
  });
}

export function useSaleDetail(transactionId: number | null) {
  return useQuery({
    queryKey: ["sale", transactionId],
    enabled: transactionId !== null,
    queryFn: () => api.request<SaleDetail>(`/api/sales/${transactionId}`),
  });
}

export type HasilHalaman = {
  data: Sale[];
  pagination?: Pagination;
};
