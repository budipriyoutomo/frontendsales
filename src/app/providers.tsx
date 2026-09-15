"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";

let browserQueryClient: QueryClient | undefined;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data penjualan tidak berubah tiap detik; satu menit cukup untuk
        // menghindari request ulang saat pindah-pindah halaman.
        staleTime: 60_000,
        retry(failureCount, error) {
          // 4xx tidak akan berubah kalau diulang — hanya 5xx dan gangguan
          // jaringan yang layak dicoba lagi. 401 sudah ditangani proxy BFF.
          if (error instanceof ApiError && error.status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });
}

function getQueryClient() {
  // Tiap render server dapat client sendiri supaya data antar-permintaan
  // tidak bocor; di browser satu client dipakai terus supaya cache bertahan.
  if (typeof window === "undefined") return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}
