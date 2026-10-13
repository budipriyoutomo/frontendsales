import { Badge } from "@/components/ui/badge";
import {
  STATUS_KIRIM,
  STATUS_LOG_KIRIM,
  STATUS_PESAN,
  type StatusPesan,
} from "@/lib/closing";
import { cn } from "@/lib/utils";

const KELAS_NADA = {
  baik: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  peringatan: "bg-amber-500/10 text-amber-800 dark:text-amber-400",
  buruk: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  netral: "",
} as const;

type Nada = keyof typeof KELAS_NADA;

function BadgeStatus({
  status,
  daftar,
}: {
  status: string;
  daftar: Record<string, { label: string; nada: Nada }>;
}) {
  if (!(status in daftar)) {
    return <Badge variant="outline">{status}</Badge>;
  }
  const { label, nada } = daftar[status];
  return (
    <Badge variant="secondary" className={cn(KELAS_NADA[nada])}>
      {label}
    </Badge>
  );
}

/** Badge status log pesan RabbitMQ (diterima, duplikat, ditolak, ...). */
export function StatusPesanBadge({ status }: { status: string }) {
  return (
    <BadgeStatus
      status={status}
      daftar={
        STATUS_PESAN as Record<StatusPesan, { label: string; nada: Nada }>
      }
    />
  );
}

/** Badge status kirim per outlet × tanggal (belum dikirim / terkirim / perlu kirim ulang). */
export function StatusKirimBadge({ status }: { status: string }) {
  return <BadgeStatus status={status} daftar={STATUS_KIRIM} />;
}

/** Badge status satu kiriman ke API eksternal (mengirim / terkirim / gagal ...). */
export function StatusLogKirimBadge({ status }: { status: string }) {
  return <BadgeStatus status={status} daftar={STATUS_LOG_KIRIM} />;
}
