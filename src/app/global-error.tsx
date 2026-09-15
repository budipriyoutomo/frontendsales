"use client";

/**
 * Batas error terakhir (TODO 8.6) — dipakai saat root layout sendiri gagal.
 * Harus membawa <html> dan <body> sendiri karena menggantikan root layout,
 * dan karena itu tidak boleh bergantung pada CSS atau komponen aplikasi.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100dvh",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          margin: 0,
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            Aplikasi gagal dimuat
          </h1>
          <p style={{ color: "#52514e", fontSize: "0.875rem" }}>
            Terjadi kesalahan yang tidak tertangani. Coba muat ulang halaman.
          </p>
          {error.digest ? (
            <p
              style={{
                color: "#898781",
                fontSize: "0.75rem",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              Kode: {error.digest}
            </p>
          ) : null}
          <button
            onClick={retry}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid #c3c2b7",
              background: "transparent",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
