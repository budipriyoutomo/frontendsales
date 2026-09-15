import Link from "next/link";

/** Halaman 404 (TODO 8.6) — bukan layar kosong. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Halaman tidak ditemukan</h1>
        <p className="text-muted-foreground text-sm">
          Alamat yang Anda buka tidak ada. Mungkin tautannya sudah berubah.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-md border px-4 py-2 text-sm font-medium"
      >
        Kembali ke dashboard
      </Link>
    </main>
  );
}
