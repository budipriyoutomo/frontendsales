"use client";

import type { ReactNode } from "react";
import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";

/**
 * Keadaan memuat / kosong / gagal, dipakai semua kartu dashboard.
 *
 * Dikumpulkan supaya ketiganya konsisten: layar kosong yang berkedip (4.7),
 * "Rp 0" yang menyesatkan (4.11), dan error tanpa jalan keluar (4.12) adalah
 * tiga cara berbeda untuk membuat user mengira datanya hilang.
 */

export function KartuSkeleton({ baris = 3 }: { baris?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat data…</span>
      {Array.from({ length: baris }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

export function KeadaanKosong({
  judul,
  keterangan,
}: {
  judul: string;
  keterangan: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Inbox aria-hidden className="text-muted-foreground size-7" />
      <p className="text-sm font-medium">{judul}</p>
      <p className="text-muted-foreground max-w-xs text-sm">{keterangan}</p>
    </div>
  );
}

export function KeadaanGagal({
  error,
  onCobaLagi,
}: {
  error: unknown;
  onCobaLagi: () => void;
}) {
  const pesan =
    error instanceof Error ? error.message : "Terjadi kesalahan tak terduga.";
  const status = error instanceof ApiError ? error.status : undefined;

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 py-10 text-center"
    >
      <AlertCircle aria-hidden className="text-destructive size-7" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Data gagal dimuat</p>
        <p className="text-muted-foreground max-w-xs text-sm">{pesan}</p>
      </div>
      {/* 403 tidak akan berubah kalau diulang — jangan tawarkan tombol palsu. */}
      {status === 403 ? null : (
        <Button variant="outline" size="sm" onClick={onCobaLagi}>
          Coba lagi
        </Button>
      )}
    </div>
  );
}

/**
 * Pembungkus satu kartu: memilih antara skeleton, error, kosong, atau isi.
 *
 * `menahan` dipakai saat refetch — render sebelumnya ditahan dengan opasitas
 * turun, bukan diganti skeleton, supaya tidak ada lompatan tata letak.
 */
export function IsiKartu<T>({
  query,
  kosong,
  children,
  barisSkeleton,
}: {
  query: {
    data: T | undefined;
    isPending: boolean;
    isFetching: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => void;
  };
  kosong: { judul: string; keterangan: string; bila?: (data: T) => boolean };
  children: (data: T) => ReactNode;
  barisSkeleton?: number;
}) {
  if (query.isPending) return <KartuSkeleton baris={barisSkeleton} />;

  if (query.isError) {
    return <KeadaanGagal error={query.error} onCobaLagi={query.refetch} />;
  }

  const data = query.data as T;
  const kosongkah = kosong.bila
    ? kosong.bila(data)
    : Array.isArray(data) && data.length === 0;

  if (kosongkah) {
    return (
      <KeadaanKosong judul={kosong.judul} keterangan={kosong.keterangan} />
    );
  }

  return (
    <div
      className={
        query.isFetching
          ? "opacity-60 transition-opacity"
          : "transition-opacity"
      }
    >
      {children(data)}
    </div>
  );
}
