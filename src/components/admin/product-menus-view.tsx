"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CircleOff } from "lucide-react";
import { toast } from "sonner";
import { MenuColorplateDialog } from "@/components/admin/menu-colorplate-dialog";
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
import { useOutlets, useSalesProductGroups } from "@/hooks/use-sales";
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
const SEMUA_OUTLET = "__semua__";

/** Jeda sebelum pencarian dikirim — satu request per ketikan terlalu boros. */
const JEDA_CARI_MS = 300;

type Konfirmasi = { mapping: ProductMenuMapping; aktifkan: boolean };

function namaMenu(m: { product_name?: string | null; product_id: number }) {
  return m.product_name?.trim() || `ProductID ${m.product_id}`;
}

/** Satu-satunya group yang dipublish langsung; menu lain lewat konversi warna. */
const COLORPLATE = "COLORPLATE";

/**
 * Mapping per menu: menu dipilih satu per satu dari group mana pun, lalu
 * dikonversi ke warna colorplate (qty × pengali) saat publish. Menu tanpa
 * warna aktif tidak dipublish.
 */
export function ProductMenusView() {
  const qc = useQueryClient();
  const [outlet, setOutlet] = useState(SEMUA_OUTLET);
  const [group, setGroup] = useState(SEMUA_GROUP);
  const [cari, setCari] = useState("");
  const [cariTerkirim, setCariTerkirim] = useState("");
  const [konfirmasi, setKonfirmasi] = useState<Konfirmasi | null>(null);
  const [aturWarnaId, setAturWarnaId] = useState<number | null>(null);

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
  const outlets = useOutlets(true);

  const outletDipilih = outlet === SEMUA_OUTLET ? undefined : outlet;
  const groupDipilih = group === SEMUA_GROUP ? undefined : group;
  const kandidat = useQuery({
    queryKey: [
      "product-menu-candidates",
      outletDipilih ?? "",
      groupDipilih ?? "",
      cariTerkirim,
    ],
    queryFn: () =>
      api.request<ProductMenuCandidate[]>("/api/product-menus/candidates", {
        query: {
          outlet: outletDipilih,
          product_group: groupDipilih,
          q: cariTerkirim || undefined,
        },
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
        description: "Tentukan warna colorplate-nya supaya ikut dipublish.",
      });
      if (baru) setAturWarnaId(baru.id);
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
  // Hanya COLORPLATE yang dipublish langsung — group lain yang aktif tidak.
  const colorplateAktif = (groupTerdaftar.data ?? []).some(
    (g) => g.is_active && normalisasiGroup(g.product_group) === COLORPLATE,
  );
  const aturWarna = semua.find((m) => m.id === aturWarnaId) ?? null;
  const pilihanGroup = [
    ...new Set((diData.data ?? []).map(normalisasiGroup).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Menu satuan</h2>
        <p className="text-muted-foreground text-sm">
          Pilih menu dari group mana pun, lalu tentukan warna colorplate
          tujuannya dan pengalinya. Contoh: menu PROMO &ldquo;Buy 1 Get 2
          RED&rdquo; → RED × 2. Saat publish, jumlahnya ditambahkan ke warna
          itu. Menu tanpa warna aktif tidak dipublish.
        </p>
        <p className="text-muted-foreground text-sm">
          Filter outlet hanya untuk mencari menu — ProductID bisa berbeda antar
          outlet. Menu yang sudah didaftarkan berlaku untuk semua outlet.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="menu-outlet">Outlet</Label>
              <Select value={outlet} onValueChange={setOutlet}>
                <SelectTrigger id="menu-outlet" className="w-48">
                  <SelectValue placeholder="Semua outlet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEMUA_OUTLET}>Semua outlet</SelectItem>
                  {(outlets.data ?? []).map((o) => (
                    <SelectItem key={o.outlet_code} value={o.outlet_code}>
                      {o.outlet_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                    <TableHead>Outlet</TableHead>
                    <TableHead>ProductID</TableHead>
                    <TableHead>Terakhir terjual</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kandidat.data.map((c) => {
                    const terdaftar = idTerdaftar.has(c.product_id);
                    const lewatGroup =
                      colorplateAktif && c.product_group === COLORPLATE;
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
                        {/* ProductID bisa berbeda antar outlet, jadi outlet
                            tempat menu ini terjual perlu terlihat. */}
                        <TableCell className="font-mono">
                          {c.outlet_codes?.length
                            ? c.outlet_codes.join(", ")
                            : "—"}
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
              keterangan="Hanya COLORPLATE yang dipublish sampai menu pertama ditambahkan di atas dan diberi warna."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Menu terdaftar</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>ProductID</TableHead>
                    <TableHead>Warna</TableHead>
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
                        <WarnaMenu menu={m} />
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
                      <TableCell className="space-x-2 text-right whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAturWarnaId(m.id)}
                        >
                          Atur warna
                        </Button>
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
                ? "Mulai publish berikutnya, penjualan menu ini ditambahkan ke warna tujuannya."
                : "Mulai publish berikutnya, penjualan menu ini tidak lagi ditambahkan ke warna mana pun."}
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

      <MenuColorplateDialog
        key={aturWarnaId ?? "tutup"}
        menu={aturWarna}
        namaMenu={aturWarna ? namaMenu(aturWarna) : ""}
        onClose={() => setAturWarnaId(null)}
      />
    </div>
  );
}

/** Ringkasan konversi di tabel: "RED × 2, BLUE × 1", atau peringatan kalau kosong. */
function WarnaMenu({ menu }: { menu: ProductMenuMapping }) {
  const aktif = (menu.colorplates ?? []).filter((c) => c.is_active);
  if (aktif.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-500">
        <AlertTriangle aria-hidden className="size-4" />
        Belum ada — tidak dipublish
      </span>
    );
  }
  return (
    <span className="font-mono text-sm">
      {aktif.map((c) => `${c.platecolor} × ${c.multiplier}`).join(", ")}
    </span>
  );
}
