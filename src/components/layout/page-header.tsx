import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Judul halaman (atau judul bagian, `level={2}`) + deskripsi + tombol aksi.
 *
 * Satu komponen supaya ukuran judul, jarak, dan letak tombol aksi sama di
 * semua halaman. `description` boleh string (jadi satu paragraf) atau
 * beberapa `<p>` sekaligus.
 */
export function PageHeader({
  title,
  description,
  details,
  detailsLabel = "Cara kerja",
  actions,
  level = 1,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Penjelasan lengkap, tersembunyi di balik "Cara kerja" sampai dibuka. */
  details?: ReactNode;
  detailsLabel?: string;
  actions?: ReactNode;
  level?: 1 | 2;
  className?: string;
}) {
  const Judul = level === 1 ? "h1" : "h2";

  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-6 gap-y-3",
        className,
      )}
    >
      <div className="min-w-0 flex-1 basis-80 space-y-1">
        <Judul
          className={cn(
            "font-semibold tracking-tight",
            level === 1 ? "text-2xl" : "text-xl",
          )}
        >
          {title}
        </Judul>
        {description == null ? null : typeof description === "string" ? (
          <p className="text-muted-foreground max-w-3xl text-sm">
            {description}
          </p>
        ) : (
          <div className="text-muted-foreground max-w-3xl space-y-1 text-sm">
            {description}
          </div>
        )}
        {details ? (
          <CaraKerja label={detailsLabel} className="pt-1">
            {details}
          </CaraKerja>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Penjelasan panjang yang tertutup secara default. Memakai `<details>` bawaan
 * supaya bisa dibuka dengan keyboard dan terbaca pembaca layar tanpa JS.
 */
export function CaraKerja({
  label = "Cara kerja",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details
      className={cn("group text-muted-foreground max-w-3xl text-sm", className)}
    >
      <summary className="text-foreground/80 hover:text-foreground inline-flex cursor-pointer list-none items-center gap-1 font-medium select-none [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-4 transition-transform group-open:rotate-90"
        />
        {label}
      </summary>
      <div className="mt-2 space-y-2 border-l-2 pl-3">{children}</div>
    </details>
  );
}
