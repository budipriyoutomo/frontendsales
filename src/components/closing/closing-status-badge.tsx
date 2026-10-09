import { Badge } from "@/components/ui/badge";
import { STATUS_PESAN, type StatusPesan } from "@/lib/closing";
import { cn } from "@/lib/utils";

const KELAS_NADA = {
  baik: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  peringatan: "bg-amber-500/10 text-amber-800 dark:text-amber-400",
  buruk: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  netral: "",
} as const;

/** Badge status log pesan RabbitMQ (diterima, duplikat, ditolak, ...). */
export function StatusPesanBadge({ status }: { status: string }) {
  if (!(status in STATUS_PESAN)) {
    return <Badge variant="outline">{status}</Badge>;
  }
  const { label, nada } = STATUS_PESAN[status as StatusPesan];
  return (
    <Badge variant="secondary" className={cn(KELAS_NADA[nada])}>
      {label}
    </Badge>
  );
}
