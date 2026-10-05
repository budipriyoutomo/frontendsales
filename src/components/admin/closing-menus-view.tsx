"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  KartuSkeleton,
  KeadaanGagal,
  KeadaanKosong,
} from "@/components/dashboard/states";
import { ClosingMenuMappingDialog } from "@/components/admin/closing-menu-mapping-dialog";
import { useClosingMenus, type StatusMenu } from "@/hooks/use-closing";
import { formatTanggalWaktuUtc } from "@/lib/format";
import type { ClosingMenu } from "@/types/domain";

/** Jeda sebelum pencarian dikirim — satu request per ketikan terlalu boros. */
const JEDA_CARI_MS = 300;

const PILIHAN_STATUS: { value: StatusMenu; label: string }[] = [
  { value: "unmapped", label: "Belum dipetakan" },
  { value: "mapped", label: "Sudah dipetakan" },
  { value: "all", label: "Semua" },
];

export function namaProduk(p: {
  product_name?: string | null;
  product_id: number;
}) {
  return p.product_name?.trim()
    ? `${p.product_name.trim()} (${p.product_id})`
    : `ProductID ${p.product_id}`;
}

/**
 * Mapping menu closing report → ProductID POS (backend TODO Fase 7.6).
 *
 * menuCode muncul sendiri begitu closing pertama yang memuatnya diterima.
 * Tanpa mapping, baris perbandingannya berstatus "belum dipetakan".
 */
export function ClosingMenusView() {
  const [status, setStatus] = useState<StatusMenu>("unmapped");
  const [cari, setCari] = useState("");
  const [cariTerkirim, setCariTerkirim] = useState("");
  const [dipilihId, setDipilihId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setCariTerkirim(cari.trim()), JEDA_CARI_MS);
    return () => clearTimeout(t);
  }, [cari]);

  const daftar = useClosingMenus(status, cariTerkirim);
  const menus = daftar.data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Mapping Menu Closing
        </h1>
        <p className="text-muted-foreground text-sm">
          Menu di closing report berasal dari sistem closing, bukan ProductID
          POS. Petakan setiap menu ke produk POS-nya — untuk sushi biasanya
          produk warna piring (mis. RED). Beberapa menu boleh dipetakan ke
          produk yang sama; di laporan perbandingan semuanya dijumlah lalu
          dibandingkan dengan qty produk itu.
        </p>
        <p className="text-muted-foreground text-sm">
          Pengali = berapa unit produk POS untuk 1 porsi menu. Umumnya 1; menu
          yang disajikan di 2 piring → pengali 2.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="closing-menu-status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as StatusMenu)}
              >
                <SelectTrigger id="closing-menu-status" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PILIHAN_STATUS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="closing-menu-cari">Cari menu</Label>
              <Input
                id="closing-menu-cari"
                className="w-72 max-w-full"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Kode atau nama menu"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          {daftar.isPending ? (
            <KartuSkeleton baris={5} />
          ) : daftar.isError ? (
            <KeadaanGagal error={daftar.error} onCobaLagi={daftar.refetch} />
          ) : menus.length === 0 ? (
            <KeadaanKosong
              judul={
                status === "unmapped"
                  ? "Semua menu sudah dipetakan"
                  : "Tidak ada menu"
              }
              keterangan={
                status === "unmapped"
                  ? "Menu baru dari closing report berikutnya akan muncul di sini."
                  : "Belum ada menu closing yang cocok dengan filter ini."
              }
            />
          ) : (
            <div
              className={
                daftar.isFetching
                  ? "overflow-x-auto opacity-60 transition-opacity"
                  : "overflow-x-auto"
              }
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Menu closing</TableHead>
                    <TableHead>ProductID POS</TableHead>
                    <TableHead>Terakhir terlihat</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {menus.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="font-medium">{m.menu_name}</div>
                        <div className="text-muted-foreground font-mono text-xs">
                          {m.menu_code ?? "tanpa kode"}
                          {m.brand_code ? ` · ${m.brand_code}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <RingkasanMapping menu={m} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTanggalWaktuUtc(m.last_seen_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDipilihId(m.id)}
                        >
                          Atur mapping
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ClosingMenuMappingDialog
        key={dipilihId ?? "tutup"}
        menuId={dipilihId}
        onClose={() => setDipilihId(null)}
      />
    </div>
  );
}

function RingkasanMapping({ menu }: { menu: ClosingMenu }) {
  const aktif = (menu.products ?? []).filter((p) => p.is_active);
  if (aktif.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-500">
        <AlertTriangle aria-hidden className="size-4" />
        Belum dipetakan
      </span>
    );
  }
  return (
    <span className="text-sm">
      {aktif.map((p) => `${namaProduk(p)} × ${p.multiplier}`).join(", ")}
    </span>
  );
}
