import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Pembungkus kerangka halaman untuk `loading.tsx`.
 *
 * Pembaca layar hanya mendengar satu "Memuat…" — balok abu-abu di dalamnya
 * disembunyikan karena tidak bermakna. Shell (sidebar, header) sengaja tidak
 * digambar di sini: `loading.tsx` dirender di dalam `layout.tsx`, jadi shell
 * yang asli tetap terpasang.
 */
export function KerangkaMemuat({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat…</span>
      <div aria-hidden="true" className="space-y-6">
        {children}
      </div>
    </div>
  );
}

/** Ukuran sama dengan `PageHeader`: judul text-2xl + satu baris deskripsi. */
export function KerangkaJudul() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
    </div>
  );
}

export function KerangkaTabel({ baris = 6 }: { baris?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: baris }).map((_, i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  );
}
