"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Ban } from "lucide-react";
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
import { Paginasi } from "@/components/layout/paginasi";
import {
  LIMIT_LAPORAN,
  useClosingMenus,
  type StatusMenu,
} from "@/hooks/use-closing";
import { formatTanggalWaktuUtc } from "@/lib/format";
import type { ClosingMenu } from "@/types/domain";
import { PageHeader } from "@/components/layout/page-header";

/** Jeda sebelum pencarian dikirim — satu request per ketikan terlalu boros. */
const JEDA_CARI_MS = 300;

const PILIHAN_STATUS: { value: StatusMenu; label: string }[] = [
  { value: "unmapped", label: "Belum dipetakan" },
  { value: "mapped", label: "Sudah dipetakan" },
  { value: "not_in_pos", label: "Tidak ada di POS" },
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
 * Tanpa mapping, baris perbandingannya berstatus "belum dipetakan" dan rekap
 * outlet + tanggalnya tidak bisa dikirim ke API — kecuali admin menandai
 * menunya "tidak ada di POS" (terkirim dengan qty POS 0).
 */
export function ClosingMenusView() {
  const [status, setStatus] = useState<StatusMenu>("unmapped");
  const [cari, setCari] = useState("");
  const [cariTerkirim, setCariTerkirim] = useState("");
  const [offset, setOffset] = useState(0);
  const [dipilihId, setDipilihId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setCariTerkirim(cari.trim());
      // Filter baru → mulai lagi dari halaman pertama.
      setOffset(0);
    }, JEDA_CARI_MS);
    return () => clearTimeout(t);
  }, [cari]);

  const daftar = useClosingMenus(status, cariTerkirim, offset);
  const menus = daftar.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mapping Menu Closing"
        description="Petakan setiap menu closing report ke produk POS-nya supaya bisa dibandingkan dengan penjualan POS."
        details={
          <>
            <p>
              Menu di closing report berasal dari sistem closing, bukan
              ProductID POS. Untuk sushi biasanya dipetakan ke produk warna
              piring (mis. RED). Beberapa menu boleh dipetakan ke produk yang
              sama; di laporan perbandingan semuanya dijumlah lalu dibandingkan
              dengan qty produk itu.
            </p>
            <p>
              Pengali = berapa unit produk POS untuk 1 porsi menu. Umumnya 1;
              menu yang disajikan di 2 piring → pengali 2.
            </p>
            <p>
              Menu Colorplate yang memang tidak dijual di POS ditandai{" "}
              <em>Tidak ada di POS</em> dari tombol Atur mapping. Menu itu tidak
              lagi memblokir kirim ke API dan terkirim dengan qty POS 0. Tanda
              dan mapping ProductID tidak bisa aktif bersamaan — admin diminta
              memilih salah satunya.
            </p>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="closing-menu-status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v as StatusMenu);
                  setOffset(0);
                }}
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
                  : status === "not_in_pos"
                    ? "Tidak ada menu yang ditandai"
                    : "Tidak ada menu"
              }
              keterangan={
                status === "unmapped"
                  ? "Menu baru dari closing report berikutnya akan muncul di sini."
                  : status === "not_in_pos"
                    ? "Menu Colorplate yang tidak dijual di POS ditandai dari tombol Atur mapping."
                    : "Belum ada menu closing yang cocok dengan filter ini."
              }
            />
          ) : (
            <div>
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

              <Paginasi
                offset={offset}
                limit={LIMIT_LAPORAN}
                pagination={daftar.data?.pagination}
                satuan="menu"
                onPindah={setOffset}
              />
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
  if (menu.not_in_pos) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
        <Ban aria-hidden className="size-4" />
        Tidak ada di POS
      </span>
    );
  }
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
