"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useSalesProductGroups } from "@/hooks/use-sales";
import { api } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/client";
import { formatTanggal } from "@/lib/format";
import { normalisasiGroup } from "@/lib/product-group";
import type {
  ProductGroupMapping,
  ProductMenuCandidate,
  ProductMenuMapping,
} from "@/types/domain";

/** Radix Select tidak menerima value kosong. */
const SEMUA_GROUP = "__semua__";

/** Jeda sebelum pencarian dikirim — satu request per ketikan terlalu boros. */
const JEDA_CARI_MS = 300;

type Konfirmasi = { mapping: ProductMenuMapping; aktifkan: boolean };

function namaMenu(m: { product_name?: string | null; product_id: number }) {
  return m.product_name?.trim() || `ProductID ${m.product_id}`;
}

/**
 * Mapping per menu: menu dipilih satu per satu dari group mana pun, lalu
 * dipublish bersama group aktif. Backend menjamin baris yang cocok lewat
 * group dan lewat menu sekaligus tetap terhitung sekali.
 */
export function ProductMenusView() {
  const qc = useQueryClient();
  const [group, setGroup] = useState(SEMUA_GROUP);
  const [cari, setCari] = useState("");
  const [cariTerkirim, setCariTerkirim] = useState("");
  const [konfirmasi, setKonfirmasi] = useState<Konfirmasi | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setCariTerkirim(cari.trim()), JEDA_CARI_MS);
    return () => clearTimeout(t);
  }, [cari]);

  const daftar = useQuery({
    queryKey: ["product-menus"],
    queryFn: () => api.request<ProductMenuMapping[]>("/api/product-menus"),
  });
  // Cache yang sama dengan ProductGroupsView — tidak menambah request.
  const groupTerdaftar = useQuery({
    queryKey: ["product-groups"],
    queryFn: () => api.request<ProductGroupMapping[]>("/api/product-groups"),
  });
  const diData = useSalesProductGroups();

  const groupDipilih = group === SEMUA_GROUP ? undefined : group;
  const kandidat = useQuery({
    queryKey: ["product-menu-candidates", groupDipilih ?? "", cariTerkirim],
    queryFn: () =>
      api.request<ProductMenuCandidate[]>("/api/product-menus/candidates", {
        query: { product_group: groupDipilih, q: cariTerkirim || undefined },
      }),
  });

  const segarkan = () => qc.invalidateQueries({ queryKey: ["product-menus"] });

  const tambah = useMutation({
    mutationFn: (c: ProductMenuCandidate) =>
      api.request<ProductMenuMapping>("/api/product-menus", {
        method: "POST",
        body: { product_id: c.product_id },
      }),
    onSuccess: (baru, c) => {
      void segarkan();
      toast.success(`${namaMenu(baru ?? c)} ditambahkan.`, {
        description: "Mulai ikut dipublish pada publish berikutnya.",
      });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        toast.error("Menu ini sudah terdaftar", {
          description: "Aktifkan dari daftar menu kalau sedang nonaktif.",
        });
        void segarkan();
        return;
      }
      toast.error(
        error instanceof Error ? error.message : "Gagal menambah menu.",
      );
    },
  });

  const ubahStatus = useMutation({
    mutationFn: ({ mapping, aktifkan }: Konfirmasi) =>
      api.request<ProductMenuMapping>(`/api/product-menus/${mapping.id}`, {
        method: "PATCH",
        body: { is_active: aktifkan },
      }),
    onSuccess: (_, { mapping, aktifkan }) => {
      setKonfirmasi(null);
      void segarkan();
      toast.success(
        `${namaMenu(mapping)} ${aktifkan ? "diaktifkan" : "dinonaktifkan"}.`,
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Gagal mengubah status.",
      ),
  });

  const semua = daftar.data ?? [];
  const idTerdaftar = new Set(semua.map((m) => m.product_id));
  const groupAktif = new Set(
    (groupTerdaftar.data ?? [])
      .filter((g) => g.is_active)
      .map((g) => normalisasiGroup(g.product_group)),
  );
  const pilihanGroup = [
    ...new Set((diData.data ?? []).map(normalisasiGroup).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Menu satuan</h2>
        <p className="text-muted-foreground text-sm">
          Pilih menu satu per satu dari group mana pun — misalnya hanya satu
          menu dari group PROMO — tanpa mengaktifkan seluruh group-nya. Menu
          dipublish bersama group aktif; menu yang group-nya sudah aktif tidak
          dikirim dua kali.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="menu-group">Group</Label>
              <Select value={group} onValueChange={setGroup}>
                <SelectTrigger id="menu-group" className="w-56">
                  <SelectValue placeholder="Semua group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEMUA_GROUP}>Semua group</SelectItem>
                  {pilihanGroup.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="menu-cari">Cari menu</Label>
              <Input
                id="menu-cari"
                className="w-72 max-w-full"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Nama menu atau ProductID"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          {kandidat.isPending ? (
            <KartuSkeleton baris={4} />
          ) : kandidat.isError ? (
            <KeadaanGagal
              error={kandidat.error}
              onCobaLagi={kandidat.refetch}
            />
          ) : kandidat.data.length === 0 ? (
            <KeadaanKosong
              judul="Tidak ada menu"
              keterangan="Tidak ada menu di data penjualan yang cocok dengan filter ini."
            />
          ) : (
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Menu</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>ProductID</TableHead>
                    <TableHead>Terakhir terjual</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kandidat.data.map((c) => {
                    const terdaftar = idTerdaftar.has(c.product_id);
                    const lewatGroup =
                      !!c.product_group && groupAktif.has(c.product_group);
                    return (
                      <TableRow
                        key={`${c.product_id}-${c.product_group}-${c.product_name}`}
                      >
                        <TableCell className="font-medium">
                          {namaMenu(c)}
                        </TableCell>
                        <TableCell className="font-mono">
                          {c.product_group ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono">
                          {c.product_id}
                        </TableCell>
                        <TableCell>{formatTanggal(c.last_sale_date)}</TableCell>
                        <TableCell className="text-right">
                          {terdaftar ? (
                            <span className="text-muted-foreground text-sm">
                              Terdaftar
                            </span>
                          ) : lewatGroup ? (
                            <span className="text-muted-foreground text-sm">
                              Sudah ikut lewat group
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={
                                tambah.isPending &&
                                tambah.variables?.product_id === c.product_id
                              }
                              onClick={() => tambah.mutate(c)}
                            >
                              Tambahkan
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {daftar.isPending ? (
            <KartuSkeleton baris={3} />
          ) : daftar.isError ? (
            <KeadaanGagal error={daftar.error} onCobaLagi={daftar.refetch} />
          ) : semua.length === 0 ? (
            <KeadaanKosong
              judul="Belum ada menu terdaftar"
              keterangan="Hanya group aktif yang dipublish sampai menu pertama ditambahkan di atas."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Menu terdaftar</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>ProductID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {semua.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        {namaMenu(m)}
                      </TableCell>
                      <TableCell className="font-mono">
                        {m.product_group ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono">
                        {m.product_id}
                      </TableCell>
                      <TableCell>
                        {m.is_active ? (
                          <span className="inline-flex items-center gap-1.5">
                            <CheckCircle2
                              aria-hidden
                              className="size-4 text-emerald-600 dark:text-emerald-500"
                            />
                            Aktif
                          </span>
                        ) : (
                          <span className="text-muted-foreground inline-flex items-center gap-1.5">
                            <CircleOff aria-hidden className="size-4" />
                            Nonaktif
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setKonfirmasi({
                              mapping: m,
                              aktifkan: !m.is_active,
                            })
                          }
                        >
                          {m.is_active ? "Nonaktifkan" : "Aktifkan"}
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

      <Dialog
        open={konfirmasi !== null}
        onOpenChange={(open) => {
          if (!open && !ubahStatus.isPending) setKonfirmasi(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {konfirmasi?.aktifkan ? "Aktifkan" : "Nonaktifkan"}{" "}
              {konfirmasi ? namaMenu(konfirmasi.mapping) : ""}?
            </DialogTitle>
            <DialogDescription>
              {konfirmasi?.aktifkan
                ? "Mulai publish berikutnya, penjualan menu ini ikut dikirim ke RabbitMQ."
                : "Mulai publish berikutnya, menu ini tidak lagi dikirim — kecuali group-nya sedang aktif."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setKonfirmasi(null)}
              disabled={ubahStatus.isPending}
            >
              Batal
            </Button>
            <Button
              variant={konfirmasi?.aktifkan ? "default" : "destructive"}
              disabled={ubahStatus.isPending}
              onClick={() => {
                if (konfirmasi) ubahStatus.mutate(konfirmasi);
              }}
            >
              {ubahStatus.isPending
                ? "Menyimpan…"
                : konfirmasi?.aktifkan
                  ? "Aktifkan menu"
                  : "Nonaktifkan menu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
