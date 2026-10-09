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
import { ProductPosMappingDialog } from "@/components/admin/product-pos-mapping-dialog";
import { api } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/client";
import { formatRupiah } from "@/lib/format";
import {
  PANJANG_KATEGORI_MAKSIMAL,
  PANJANG_SATUAN_MAKSIMAL,
  bacaHarga,
  normalisasiKodeProduk,
  validasiHarga,
  validasiKodeProduk,
  validasiNamaProduk,
  validasiTeksOpsional,
} from "@/lib/product";
import type { Brand, Product } from "@/types/domain";

/** Nilai sentinel — `Select` tidak menerima item bernilai string kosong. */
const TANPA_BRAND = "__tanpa__";

type IsiForm = {
  code: string;
  name: string;
  category: string;
  unit: string;
  price: string;
  brand: string;
  is_active: boolean;
};

type Galat = Partial<Record<keyof IsiForm, string | null>>;

/** `null` = dialog tertutup, `"baru"` = tambah, Product = ubah. */
type Sasaran = "baru" | Product | null;

const FORM_KOSONG: IsiForm = {
  code: "",
  name: "",
  category: "",
  unit: "",
  price: "",
  brand: TANPA_BRAND,
  is_active: true,
};

function dariProduk(p: Product): IsiForm {
  return {
    code: p.code,
    name: p.name,
    category: p.category ?? "",
    unit: p.unit ?? "",
    price: String(p.price),
    brand: p.brand ? String(p.brand.id) : TANPA_BRAND,
    is_active: p.is_active,
  };
}

function validasi(isi: IsiForm, baru: boolean): Galat {
  return {
    code: baru ? validasiKodeProduk(isi.code) : null,
    name: validasiNamaProduk(isi.name),
    category: validasiTeksOpsional(
      isi.category,
      "Kategori",
      PANJANG_KATEGORI_MAKSIMAL,
    ),
    unit: validasiTeksOpsional(isi.unit, "Satuan", PANJANG_SATUAN_MAKSIMAL),
    price: validasiHarga(isi.price),
  };
}

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

function PesanGalat({ id, pesan }: { id: string; pesan?: string | null }) {
  return pesan ? (
    <p id={`${id}-galat`} role="alert" className="text-destructive text-xs">
      {pesan}
    </p>
  ) : null;
}

function cocok(p: Product, kata: string) {
  if (!kata) return true;
  const k = kata.toUpperCase();
  return [p.code, p.name, p.category, p.brand?.code, p.brand?.name].some((v) =>
    v?.toUpperCase().includes(k),
  );
}

export function ProductsView() {
  const [cari, setCari] = useState("");
  const [sasaran, setSasaran] = useState<Sasaran>(null);
  const [mappingId, setMappingId] = useState<number | null>(null);

  const products = useQuery({
    queryKey: ["products"],
    queryFn: () => api.request<Product[]>("/api/products"),
  });

  const semua = products.data ?? [];
  const tampil = semua.filter((p) => cocok(p, cari.trim()));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Produk</h1>
        <p className="text-muted-foreground text-sm">
          Master data produk. ProductID dari POS bisa berbeda di tiap outlet —
          petakan ProductID tiap outlet ke produk di sini supaya produk yang
          sama dikenali sebagai satu produk.
        </p>
        <p className="text-muted-foreground text-sm">
          Produk tidak bisa dihapus dan kodenya tidak bisa diganti. Produk yang
          tidak dipakai lagi cukup dinonaktifkan.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cari-produk">Cari</Label>
          <Input
            id="cari-produk"
            className="w-72 max-w-full"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Kode, nama, kategori, atau brand"
            autoComplete="off"
          />
        </div>
        <Button onClick={() => setSasaran("baru")}>Tambah produk</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {products.isPending ? (
            <KartuSkeleton baris={4} />
          ) : products.isError ? (
            <KeadaanGagal
              error={products.error}
              onCobaLagi={products.refetch}
            />
          ) : semua.length === 0 ? (
            <KeadaanKosong
              judul="Belum ada produk"
              keterangan="Tambahkan produk pertama, lalu petakan ProductID POS tiap outlet ke produk itu."
            />
          ) : tampil.length === 0 ? (
            <KeadaanKosong
              judul="Tidak ada yang cocok"
              keterangan="Ubah kata pencarian."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Satuan</TableHead>
                    <TableHead className="text-right">Harga</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>ProductID POS</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tampil.map((p) => {
                    const aktif = (p.pos_mappings ?? []).filter(
                      (m) => m.is_active,
                    ).length;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono font-medium">
                          {p.code}
                        </TableCell>
                        <TableCell>{p.name}</TableCell>
                        <TableCell>{p.category ?? "—"}</TableCell>
                        <TableCell>{p.unit ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatRupiah(p.price)}
                        </TableCell>
                        <TableCell>
                          {p.brand ? (
                            <span className="font-mono">{p.brand.code}</span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {aktif ? (
                            `${aktif} outlet`
                          ) : (
                            <span className="text-muted-foreground">
                              Belum dipetakan
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Status aktif={p.is_active} />
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="inline-flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setMappingId(p.id)}
                              aria-label={`Mapping POS ${p.code}`}
                            >
                              Mapping POS
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSasaran(p)}
                              aria-label={`Ubah ${p.code}`}
                            >
                              Ubah
                            </Button>
                          </div>
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

      <ProductFormDialog
        // Remount tiap sasaran berganti supaya isi form selalu segar.
        key={
          sasaran === null ? "tutup" : sasaran === "baru" ? "baru" : sasaran.id
        }
        sasaran={sasaran}
        onClose={() => setSasaran(null)}
      />
      <ProductPosMappingDialog
        productId={mappingId}
        onClose={() => setMappingId(null)}
      />
    </div>
  );
}

function ProductFormDialog({
  sasaran,
  onClose,
}: {
  sasaran: Sasaran;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const baru = sasaran === "baru";
  const produk = sasaran !== null && sasaran !== "baru" ? sasaran : null;
  const awal = produk ? dariProduk(produk) : FORM_KOSONG;

  const [isi, setIsi] = useState<IsiForm>(awal);
  const [galat, setGalat] = useState<Galat>({});

  const brands = useQuery({
    queryKey: ["brands"],
    enabled: sasaran !== null,
    queryFn: () => api.request<Brand[]>("/api/brands"),
  });

  const simpan = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      produk
        ? api.request<Product>(`/api/products/${produk.id}`, {
            method: "PATCH",
            body,
          })
        : api.request<Product>("/api/products", { method: "POST", body }),
    onSuccess: (hasil) => {
      void qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(
        `Produk ${hasil?.code ?? ""} ${baru ? "ditambahkan" : "disimpan"}.`,
      );
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setGalat({
          code: "Kode ini sudah terdaftar. Aktifkan dari daftar kalau sedang nonaktif.",
        });
        return;
      }
      if (error instanceof ApiError && error.status === 422) {
        const f = error.fieldErrors;
        if (f) {
          setGalat({
            code: f.code ?? null,
            name: f.name ?? null,
            category: f.category ?? null,
            unit: f.unit ?? null,
            price: f.price ?? null,
            brand: f.brand_id ?? null,
          });
        } else {
          // Brand nonaktif / tidak ada — satu-satunya 422 tanpa field.
          setGalat({ brand: error.message });
        }
        return;
      }
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan produk.",
      );
    },
  });

  function ubahField<K extends keyof IsiForm>(k: K, v: IsiForm[K]) {
    setIsi((s) => ({ ...s, [k]: v }));
    if (galat[k]) setGalat((g) => ({ ...g, [k]: null }));
  }

  function kirim(e: React.FormEvent) {
    e.preventDefault();
    const masalah = validasi(isi, baru);
    setGalat(masalah);
    if (Object.values(masalah).some(Boolean)) return;

    const brand_id = isi.brand === TANPA_BRAND ? null : Number(isi.brand);
    const umum = {
      name: isi.name,
      category: isi.category.trim() || null,
      unit: isi.unit.trim() || null,
      brand_id,
      is_active: isi.is_active,
    };

    if (baru) {
      simpan.mutate({ code: isi.code, ...umum, price: bacaHarga(isi.price) });
      return;
    }
    // Harga dikirim hanya kalau diubah: harga berdesimal yang diisi lewat API
    // tidak ikut terpotong hanya karena nama yang disunting.
    simpan.mutate(
      isi.price.trim() === awal.price
        ? umum
        : { ...umum, price: bacaHarga(isi.price) },
    );
  }

  const semuaBrand = brands.data ?? [];
  const brandDipilih = semuaBrand.find((b) => String(b.id) === isi.brand);
  const pratinjau = baru ? normalisasiKodeProduk(isi.code) : "";

  const atribut = (id: string, k: keyof IsiForm) => ({
    id,
    "aria-invalid": galat[k] ? true : undefined,
    "aria-describedby": galat[k] ? `${id}-galat` : undefined,
  });

  return (
    <Dialog
      open={sasaran !== null}
      onOpenChange={(open) => {
        if (!open && !simpan.isPending) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <form onSubmit={kirim} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {produk ? (
                <>
                  Ubah produk <span className="font-mono">{produk.code}</span>
                </>
              ) : (
                "Tambah produk"
              )}
            </DialogTitle>
            <DialogDescription>
              {produk
                ? "Kode tidak bisa diganti. Menonaktifkan produk tidak melepas mapping POS-nya."
                : "Kode disimpan dalam huruf besar dan tidak bisa diganti setelah dibuat."}
            </DialogDescription>
          </DialogHeader>

          {baru ? (
            <div className="space-y-1.5">
              <Label htmlFor="produk_code">Kode</Label>
              <Input
                {...atribut("produk_code", "code")}
                aria-describedby={
                  galat.code
                    ? "produk_code-galat"
                    : pratinjau
                      ? "produk_code-pratinjau"
                      : undefined
                }
                value={isi.code}
                onChange={(e) => ubahField("code", e.target.value)}
                placeholder="P-001"
                autoComplete="off"
                spellCheck={false}
              />
              {galat.code ? (
                <PesanGalat id="produk_code" pesan={galat.code} />
              ) : pratinjau ? (
                <p
                  id="produk_code-pratinjau"
                  className="text-muted-foreground text-xs"
                >
                  Akan tersimpan sebagai{" "}
                  <code className="text-foreground font-mono font-semibold">
                    {pratinjau}
                  </code>
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="produk_name">Nama produk</Label>
            <Input
              {...atribut("produk_name", "name")}
              value={isi.name}
              onChange={(e) => ubahField("name", e.target.value)}
              placeholder="Red Plate"
              autoComplete="off"
            />
            <PesanGalat id="produk_name" pesan={galat.name} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="produk_category">Kategori</Label>
              <Input
                {...atribut("produk_category", "category")}
                value={isi.category}
                onChange={(e) => ubahField("category", e.target.value)}
                placeholder="Opsional"
                autoComplete="off"
              />
              <PesanGalat id="produk_category" pesan={galat.category} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="produk_unit">Satuan</Label>
              <Input
                {...atribut("produk_unit", "unit")}
                value={isi.unit}
                onChange={(e) => ubahField("unit", e.target.value)}
                placeholder="pcs, porsi, …"
                autoComplete="off"
              />
              <PesanGalat id="produk_unit" pesan={galat.unit} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="produk_price">Harga (Rp)</Label>
              <Input
                {...atribut("produk_price", "price")}
                inputMode="numeric"
                value={isi.price}
                onChange={(e) => ubahField("price", e.target.value)}
                placeholder="0"
                autoComplete="off"
              />
              <PesanGalat id="produk_price" pesan={galat.price} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="produk_brand">Brand</Label>
              <Select
                value={isi.brand}
                onValueChange={(v) => ubahField("brand", v)}
              >
                <SelectTrigger
                  id="produk_brand"
                  className="w-full"
                  aria-invalid={galat.brand ? true : undefined}
                  aria-describedby={
                    galat.brand ? "produk_brand-galat" : undefined
                  }
                >
                  <SelectValue placeholder="Tanpa brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TANPA_BRAND}>Tanpa brand</SelectItem>
                  {semuaBrand
                    .filter((b) => b.is_active)
                    .map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.name} ({b.code})
                      </SelectItem>
                    ))}
                  {/* Brand nonaktif yang masih dipegang produk tetap
                      ditampilkan, supaya nilainya tidak tampak kosong. */}
                  {brandDipilih && !brandDipilih.is_active ? (
                    <SelectItem value={String(brandDipilih.id)} disabled>
                      {brandDipilih.name} ({brandDipilih.code}) — nonaktif
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
              <PesanGalat id="produk_brand" pesan={galat.brand} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="produk_aktif"
              checked={isi.is_active}
              onCheckedChange={(v) => ubahField("is_active", v)}
            />
            <Label htmlFor="produk_aktif">Aktif</Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={simpan.isPending}
            >
              Batal
            </Button>
            <Button type="submit" disabled={simpan.isPending}>
              {simpan.isPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
