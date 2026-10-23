"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { bolehDiulang } from "@/lib/api/retry";

let browserQueryClient: QueryClient | undefined;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data penjualan tidak berubah tiap detik; satu menit cukup untuk
        // menghindari request ulang saat pindah-pindah halaman.
        staleTime: 60_000,
        retry: bolehDiulang,
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
    // Tema terang/gelap: kelas `.dark` di <html>, default ikut sistem.
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={getQueryClient()}>
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
