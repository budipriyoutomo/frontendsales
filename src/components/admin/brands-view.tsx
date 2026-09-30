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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import { api } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/client";
import {
  normalisasiKodeBrand,
  validasiKodeBrand,
  validasiNamaBrand,
} from "@/lib/brand";
import type { Brand, OutletBrand } from "@/types/domain";

/** Nilai sentinel — `Select` tidak menerima item bernilai string kosong. */
const TANPA_BRAND = "__tanpa__";

type Galat = { code?: string | null; name?: string | null };
type UbahBrand = { brand: Brand; name: string; is_active: boolean };

function Status({ aktif }: { aktif: boolean }) {
  // Ikon + teks, tidak pernah warna saja (8.7).
  return aktif ? (
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
  );
}

export function BrandsView() {
  const qc = useQueryClient();
  const [kode, setKode] = useState("");
  const [nama, setNama] = useState("");
  const [galat, setGalat] = useState<Galat>({});
  const [ubah, setUbah] = useState<UbahBrand | null>(null);

  const brands = useQuery({
    queryKey: ["brands"],
    queryFn: () => api.request<Brand[]>("/api/brands"),
  });
  const outlets = useQuery({
    queryKey: ["brand-outlets"],
    queryFn: () => api.request<OutletBrand[]>("/api/brands/outlets"),
  });

  const segarkan = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["brands"] }),
      qc.invalidateQueries({ queryKey: ["brand-outlets"] }),
      // Dropdown outlet di filter dashboard ikut membawa brand.
      qc.invalidateQueries({ queryKey: ["outlets"] }),
    ]);

  const tambah = useMutation({
    mutationFn: (body: { code: string; name: string }) =>
      api.request<Brand>("/api/brands", { method: "POST", body }),
    onSuccess: (baru) => {
      setKode("");
      setNama("");
      setGalat({});
      void segarkan();
      toast.success(`Brand ${baru?.code ?? ""} ditambahkan.`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setGalat({
          code: "Kode ini sudah terdaftar. Aktifkan dari daftar kalau sedang nonaktif.",
        });
        return;
      }
      if (error instanceof ApiError && error.status === 422) {
        setGalat({
          code: error.fieldErrors?.code ?? null,
          name:
            error.fieldErrors?.name ??
            (error.fieldErrors ? null : error.message),
        });
        return;
      }
      toast.error(
        error instanceof Error ? error.message : "Gagal menambah brand.",
      );
    },
  });

  const simpanUbah = useMutation({
    mutationFn: ({ brand, name, is_active }: UbahBrand) =>
      api.request<Brand>(`/api/brands/${brand.id}`, {
        method: "PATCH",
        body: { name, is_active },
      }),
    onSuccess: (hasil) => {
      setUbah(null);
      void segarkan();
      toast.success(`Brand ${hasil?.code ?? ""} disimpan.`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan brand.",
      ),
  });

  const petakan = useMutation({
    mutationFn: ({
      outlet_code,
      brand_id,
    }: {
      outlet_code: string;
      brand_id: number | null;
    }) =>
      api.request<OutletBrand>(
        `/api/brands/outlets/${encodeURIComponent(outlet_code)}`,
        { method: "PUT", body: { brand_id } },
      ),
    onSuccess: (hasil) => {
      void segarkan();
      toast.success(
        hasil?.brand_code
          ? `${hasil.outlet_code} dipetakan ke ${hasil.brand_code}.`
          : `${hasil?.outlet_code ?? "Outlet"} dilepas dari brand.`,
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Gagal memetakan outlet.",
      ),
  });

  function kirim(e: React.FormEvent) {
    e.preventDefault();
    const masalah = {
      code: validasiKodeBrand(kode),
      name: validasiNamaBrand(nama),
    };
    setGalat(masalah);
    if (masalah.code || masalah.name) return;
    tambah.mutate({ code: kode, name: nama });
  }

  const semuaBrand = brands.data ?? [];
  const brandAktif = semuaBrand.filter((b) => b.is_active);
  const pratinjau = normalisasiKodeBrand(kode);
  const galatUbahNama = ubah ? validasiNamaBrand(ubah.name) : null;

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Brand</h1>
          <p className="text-muted-foreground text-sm">
            Brand mengelompokkan outlet. Laporan dashboard dan transaksi bisa
            difilter per brand; satu outlet hanya bisa masuk satu brand.
          </p>
          <p className="text-muted-foreground text-sm">
            Brand tidak bisa dihapus dan kodenya tidak bisa diganti — kode
            dipakai di tautan laporan yang sudah dibagikan. Brand yang tidak
            dipakai lagi cukup dinonaktifkan.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form
              className="flex flex-wrap items-start gap-3"
              onSubmit={kirim}
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="brand_code">Kode</Label>
                <Input
                  id="brand_code"
                  className="w-40 max-w-full"
                  value={kode}
                  onChange={(e) => {
                    setKode(e.target.value);
                    if (galat.code) setGalat({ ...galat, code: null });
                  }}
                  placeholder="MHR"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={galat.code ? true : undefined}
                  aria-describedby={
                    galat.code
                      ? "brand_code-galat"
                      : pratinjau
                        ? "brand_code-pratinjau"
                        : undefined
                  }
                />
                {galat.code ? (
                  <p
                    id="brand_code-galat"
                    role="alert"
                    className="text-destructive text-xs"
                  >
                    {galat.code}
                  </p>
                ) : pratinjau ? (
                  <p
                    id="brand_code-pratinjau"
                    className="text-muted-foreground text-xs"
                  >
                    Akan tersimpan sebagai{" "}
                    <code className="text-foreground font-mono font-semibold">
                      {pratinjau}
                    </code>
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand_name">Nama brand</Label>
                <Input
                  id="brand_name"
                  className="w-72 max-w-full"
                  value={nama}
                  onChange={(e) => {
                    setNama(e.target.value);
                    if (galat.name) setGalat({ ...galat, name: null });
                  }}
                  placeholder="Maharasa"
                  autoComplete="off"
                  aria-invalid={galat.name ? true : undefined}
                  aria-describedby={galat.name ? "brand_name-galat" : undefined}
                />
                {galat.name ? (
                  <p
                    id="brand_name-galat"
                    role="alert"
                    className="text-destructive text-xs"
                  >
                    {galat.name}
                  </p>
                ) : null}
              </div>
              <Button
                type="submit"
                className="mt-6"
                disabled={tambah.isPending}
              >
                {tambah.isPending ? "Menambah…" : "Tambah brand"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {brands.isPending ? (
              <KartuSkeleton baris={3} />
            ) : brands.isError ? (
              <KeadaanGagal error={brands.error} onCobaLagi={brands.refetch} />
            ) : semuaBrand.length === 0 ? (
              <KeadaanKosong
                judul="Belum ada brand"
                keterangan="Tambahkan brand pertama di atas, lalu petakan outlet ke brand itu."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Outlet</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {semuaBrand.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono font-medium">
                          {b.code}
                        </TableCell>
                        <TableCell>{b.name}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {b.outlet_codes?.length ? (
                            b.outlet_codes.join(", ")
                          ) : (
                            <span className="text-muted-foreground font-sans">
                              Belum ada
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Status aktif={b.is_active} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setUbah({
                                brand: b,
                                name: b.name,
                                is_active: b.is_active,
                              })
                            }
                          >
                            Ubah
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
      </div>

      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            Outlet per brand
          </h2>
          <p className="text-muted-foreground text-sm">
            Daftar outlet diambil dari API key. Mengganti brand sebuah outlet
            langsung mengubah laporan yang difilter per brand — termasuk untuk
            tanggal yang sudah lewat. Hanya brand aktif yang bisa dipilih.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {outlets.isPending ? (
              <KartuSkeleton baris={4} />
            ) : outlets.isError ? (
              <KeadaanGagal
                error={outlets.error}
                onCobaLagi={outlets.refetch}
              />
            ) : (outlets.data ?? []).length === 0 ? (
              <KeadaanKosong
                judul="Belum ada outlet"
                keterangan="Outlet muncul di sini setelah API key-nya dibuat."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Outlet</TableHead>
                      <TableHead>API key</TableHead>
                      <TableHead>Brand</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(outlets.data ?? []).map((o) => {
                      const brandSekarang = semuaBrand.find(
                        (b) => b.id === o.brand_id,
                      );
                      return (
                        <TableRow key={o.outlet_code}>
                          <TableCell className="font-mono font-medium">
                            {o.outlet_code}
                          </TableCell>
                          <TableCell>
                            <Status aktif={o.is_active} />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={
                                o.brand_id != null
                                  ? String(o.brand_id)
                                  : TANPA_BRAND
                              }
                              disabled={petakan.isPending}
                              onValueChange={(v) =>
                                petakan.mutate({
                                  outlet_code: o.outlet_code,
                                  brand_id:
                                    v === TANPA_BRAND ? null : Number(v),
                                })
                              }
                            >
                              <SelectTrigger
                                className="w-56"
                                aria-label={`Brand untuk ${o.outlet_code}`}
                              >
                                <SelectValue placeholder="Tanpa brand" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={TANPA_BRAND}>
                                  Tanpa brand
                                </SelectItem>
                                {brandAktif.map((b) => (
                                  <SelectItem key={b.id} value={String(b.id)}>
                                    {b.name} ({b.code})
                                  </SelectItem>
                                ))}
                                {/* Brand nonaktif yang masih dipegang outlet
                                    tetap ditampilkan, supaya nilainya tidak
                                    tampak kosong. */}
                                {brandSekarang && !brandSekarang.is_active ? (
                                  <SelectItem
                                    value={String(brandSekarang.id)}
                                    disabled
                                  >
                                    {brandSekarang.name} ({brandSekarang.code})
                                    — nonaktif
                                  </SelectItem>
                                ) : null}
                              </SelectContent>
                            </Select>
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
      </div>

      <Dialog
        open={ubah !== null}
        onOpenChange={(open) => {
          if (!open && !simpanUbah.isPending) setUbah(null);
        }}
      >
        <DialogContent className="max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (ubah && !galatUbahNama) simpanUbah.mutate(ubah);
            }}
            noValidate
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>
                Ubah brand <span className="font-mono">{ubah?.brand.code}</span>
              </DialogTitle>
              <DialogDescription>
                Kode tidak bisa diganti. Menonaktifkan brand tidak melepas
                outlet-nya dan laporannya tetap bisa difilter, tapi outlet baru
                tidak bisa dipetakan ke brand ini.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="ubah_brand_name">Nama brand</Label>
              <Input
                id="ubah_brand_name"
                value={ubah?.name ?? ""}
                onChange={(e) =>
                  ubah && setUbah({ ...ubah, name: e.target.value })
                }
                aria-invalid={galatUbahNama ? true : undefined}
                aria-describedby={
                  galatUbahNama ? "ubah_brand_name-galat" : undefined
                }
              />
              {galatUbahNama ? (
                <p
                  id="ubah_brand_name-galat"
                  role="alert"
                  className="text-destructive text-xs"
                >
                  {galatUbahNama}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="ubah_brand_aktif"
                checked={ubah?.is_active ?? false}
                onCheckedChange={(aktif) =>
                  ubah && setUbah({ ...ubah, is_active: aktif })
                }
              />
              <Label htmlFor="ubah_brand_aktif">Aktif</Label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setUbah(null)}
                disabled={simpanUbah.isPending}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={simpanUbah.isPending || galatUbahNama !== null}
              >
                {simpanUbah.isPending ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
