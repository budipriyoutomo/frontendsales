"use client";

import { useState } from "react";
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
import { formatTanggalWaktu } from "@/lib/format";
import {
  normalisasiGroup,
  saranGroup,
  validasiNamaGroup,
} from "@/lib/product-group";
import type { ProductGroupMapping } from "@/types/domain";

/** Saran dibatasi supaya data penjualan yang ramai tidak menenggelamkan form. */
const SARAN_MAKSIMAL = 12;

type Konfirmasi = { mapping: ProductGroupMapping; aktifkan: boolean };

export function ProductGroupsView() {
  const qc = useQueryClient();
  const [nama, setNama] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<Konfirmasi | null>(null);

  const daftar = useQuery({
    queryKey: ["product-groups"],
    queryFn: () => api.request<ProductGroupMapping[]>("/api/product-groups"),
  });
  const diData = useSalesProductGroups();

  const segarkan = () => qc.invalidateQueries({ queryKey: ["product-groups"] });

  const tambah = useMutation({
    // Nama dikirim apa adanya; normalisasi tetap wewenang backend.
    mutationFn: (product_group: string) =>
      api.request<ProductGroupMapping>("/api/product-groups", {
        method: "POST",
        body: { product_group },
      }),
    onSuccess: (baru) => {
      setNama("");
      setGalat(null);
      void segarkan();
      toast.success(`Group ${baru?.product_group ?? ""} ditambahkan.`, {
        description: "Mulai ikut dipublish pada publish berikutnya.",
      });
    },
    onError: (error) => {
      // Sudah terdaftar — termasuk yang nonaktif. Arahkan ke daftar, jangan
      // biarkan tampil sebagai "terjadi kesalahan" (TODO 10.6, pola 6.2).
      if (error instanceof ApiError && error.status === 409) {
        toast.error("Group ini sudah terdaftar", {
          description:
            "Aktifkan dari daftar di bawah kalau sedang nonaktif — group yang sama tidak bisa ditambahkan dua kali.",
        });
        return;
      }
      if (error instanceof ApiError && error.status === 422) {
        setGalat(error.fieldErrors?.product_group ?? error.message);
        return;
      }
      toast.error(
        error instanceof Error ? error.message : "Gagal menambah group.",
      );
    },
  });

  const ubahStatus = useMutation({
    mutationFn: ({ mapping, aktifkan }: Konfirmasi) =>
      api.request<ProductGroupMapping>(`/api/product-groups/${mapping.id}`, {
        method: "PATCH",
        body: { is_active: aktifkan },
      }),
    onSuccess: (_, { mapping, aktifkan }) => {
      setKonfirmasi(null);
      void segarkan();
      toast.success(
        `${mapping.product_group} ${aktifkan ? "diaktifkan" : "dinonaktifkan"}.`,
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Gagal mengubah status.",
      ),
  });

  function kirim(e: React.FormEvent) {
    e.preventDefault();
    const masalah = validasiNamaGroup(nama);
    setGalat(masalah);
    if (masalah) return;
    tambah.mutate(nama);
  }

  const semua = daftar.data ?? [];
  const pratinjau = normalisasiGroup(nama);
  const saran = daftar.isSuccess
    ? saranGroup(diData.data ?? [], semua).slice(0, SARAN_MAKSIMAL)
    : [];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Product Group</h1>
        <p className="text-muted-foreground text-sm">
          Group yang penjualannya dipublish ke RabbitMQ. Perubahan di sini
          berlaku pada publish berikutnya dan langsung mengubah event yang
          diterima consumer.
        </p>
        <p className="text-muted-foreground text-sm">
          Group tidak bisa dihapus atau diganti namanya: barisnya disimpan
          sebagai jejak group apa saja yang pernah dipublish. Salah ketik?
          Tambahkan nama yang benar, lalu nonaktifkan yang lama.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <form
            className="flex flex-wrap items-start gap-3"
            onSubmit={kirim}
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="product_group">Nama group</Label>
              <Input
                id="product_group"
                className="w-72 max-w-full"
                value={nama}
                onChange={(e) => {
                  setNama(e.target.value);
                  if (galat) setGalat(null);
                }}
                placeholder="COLORPLATE"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={galat ? true : undefined}
                aria-describedby={
                  galat
                    ? "product_group-galat"
                    : pratinjau
                      ? "product_group-pratinjau"
                      : // Tanpa pratinjau tidak ada elemennya — menunjuk id
                        // yang tidak ada membuat pembaca layar diam saja.
                        undefined
                }
              />
              {galat ? (
                <p
                  id="product_group-galat"
                  role="alert"
                  className="text-destructive text-xs"
                >
                  {galat}
                </p>
              ) : pratinjau ? (
                // Nama tersimpan dalam bentuk normal — tunjukkan sebelum
                // dikirim, supaya "colorplate" di daftar tidak mengejutkan.
                <p
                  id="product_group-pratinjau"
                  className="text-muted-foreground text-xs"
                >
                  Akan tersimpan sebagai{" "}
                  <code className="text-foreground font-mono font-semibold">
                    {pratinjau}
                  </code>
                </p>
              ) : null}
            </div>
            <Button type="submit" className="mt-6" disabled={tambah.isPending}>
              {tambah.isPending ? "Menambah…" : "Tambah group"}
            </Button>
          </form>

          {saran.length > 0 ? (
            <div className="space-y-1.5">
              <p id="saran-group" className="text-muted-foreground text-xs">
                Saran dari data penjualan — belum terdaftar:
              </p>
              <div
                role="group"
                aria-labelledby="saran-group"
                className="flex flex-wrap gap-1.5"
              >
                {saran.map((g) => (
                  <Button
                    key={g}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="font-mono"
                    onClick={() => {
                      setNama(g);
                      setGalat(null);
                    }}
                  >
                    {g}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {daftar.isPending ? (
            <KartuSkeleton baris={4} />
          ) : daftar.isError ? (
            <KeadaanGagal error={daftar.error} onCobaLagi={daftar.refetch} />
          ) : semua.length === 0 ? (
            <KeadaanKosong
              judul="Belum ada group terdaftar"
              keterangan="Tidak ada penjualan yang dipublish sampai group pertama ditambahkan di atas."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead>Diubah</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {semua.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono font-medium">
                        {m.product_group}
                      </TableCell>
                      <TableCell>
                        {/* Ikon + teks, tidak pernah warna saja (8.7). */}
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
                      <TableCell>{formatTanggalWaktu(m.created_at)}</TableCell>
                      <TableCell>{formatTanggalWaktu(m.updated_at)}</TableCell>
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
              <span className="font-mono">
                {konfirmasi?.mapping.product_group}
              </span>
              ?
            </DialogTitle>
            <DialogDescription>
              {konfirmasi?.aktifkan
                ? "Mulai publish berikutnya, penjualan group ini ikut dikirim ke RabbitMQ. Pastikan consumer sudah siap menerima event-nya — termasuk event tanpa field platecolor."
                : "Mulai publish berikutnya, penjualan group ini tidak lagi dikirim ke RabbitMQ, dan consumer berhenti menerima event-nya."}
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
                  ? "Aktifkan group"
                  : "Nonaktifkan group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
