"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Batas error untuk halaman di dalam shell (TODO 8.6).
 *
 * Shell (sidebar, topbar) tetap terpasang, jadi user masih bisa pindah
 * halaman alih-alih terjebak di layar putih.
 */
export default function ErrorHalaman({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center"
    >
      <AlertCircle aria-hidden className="text-destructive size-10" />

      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Halaman ini gagal dimuat</h1>
        <p className="text-muted-foreground text-sm">
          Terjadi kesalahan saat menyiapkan halaman. Data Anda tidak berubah.
        </p>
        {/* `digest` adalah satu-satunya penghubung ke log server — pesan
            error asli sengaja tidak dikirim ke browser. */}
        {error.digest ? (
          <p className="text-muted-foreground font-mono text-xs">
            Kode: {error.digest}
          </p>
        ) : null}
      </div>

      <Button onClick={retry}>Coba lagi</Button>
    </div>
  );
}
