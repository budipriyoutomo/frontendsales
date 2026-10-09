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
import { ProductImportDialog } from "@/components/admin/product-import-dialog";
import { ProductPosMappingDialog } from "@/components/admin/product-pos-mapping-dialog";
import { api } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/client";
import {
  PANJANG_KATEGORI_MAKSIMAL,
  PANJANG_SUBKATEGORI_MAKSIMAL,
  normalisasiKodeProduk,
  validasiKodeProduk,
  validasiNamaProduk,
  validasiTeksOpsional,
} from "@/lib/product";
import type { Brand, Product } from "@/types/domain";

/** Wajib: ProductID, Product Code, nama, brand. Sisanya opsional. */
type IsiForm = {
  code: string;
  product_code: string;
  name: string;
  category: string;
  subcategory: string;
  /** id brand sebagai string; "" = belum dipilih. */
  brand: string;
  is_active: boolean;
};

type Galat = Partial<Record<keyof IsiForm, string | null>>;

/** `null` = dialog tertutup, `"baru"` = tambah, Product = ubah. */
type Sasaran = "baru" | Product | null;

const FORM_KOSONG: IsiForm = {
  code: "",
  product_code: "",
  name: "",
  category: "",
  subcategory: "",
  brand: "",
  is_active: true,
};

function dariProduk(p: Product): IsiForm {
  return {
    code: p.code,
    // Produk lama (sebelum migrasi 015) belum punya Product Code / brand —
    // dibiarkan kosong supaya admin wajib melengkapinya saat mengubah.
    product_code: p.product_code ?? "",
    name: p.name,
    category: p.category ?? "",
    subcategory: p.subcategory ?? "",
    brand: p.brand ? String(p.brand.id) : "",
    is_active: p.is_active,
  };
}

function validasi(isi: IsiForm, baru: boolean): Galat {
  return {
    code: baru ? validasiKodeProduk(isi.code) : null,
    product_code: validasiKodeProduk(isi.product_code, "Product Code"),
    name: validasiNamaProduk(isi.name),
    brand: isi.brand ? null : "Brand wajib dipilih.",
    category: validasiTeksOpsional(
      isi.category,
      "Kategori",
      PANJANG_KATEGORI_MAKSIMAL,
    ),
    subcategory: validasiTeksOpsional(
      isi.subcategory,
      "Subkategori",
      PANJANG_SUBKATEGORI_MAKSIMAL,
    ),
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

/** Field wajib yang masih kosong di produk lama (sebelum migrasi 015). */
function BelumDiisi() {
  return (
    <span className="text-sm text-amber-800 dark:text-amber-400">
      Belum diisi
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
  return [
    p.code,
    p.product_code,
    p.name,
    p.category,
    p.subcategory,
    p.brand?.code,
    p.brand?.name,
  ].some((v) => v?.toUpperCase().includes(k));
}

export function ProductsView() {
  const [cari, setCari] = useState("");
  const [sasaran, setSasaran] = useState<Sasaran>(null);
  const [mappingId, setMappingId] = useState<number | null>(null);
  const [imporBuka, setImporBuka] = useState(false);

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
          Produk tidak bisa dihapus dan ProductID-nya tidak bisa diganti. Produk
          yang tidak dipakai lagi cukup dinonaktifkan.
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
            placeholder="ProductID, Product Code, nama, kategori, atau brand"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImporBuka(true)}>
            Ambil dari transaksi
          </Button>
          <Button onClick={() => setSasaran("baru")}>Tambah produk</Button>
        </div>
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
              keterangan="Tambahkan produk pertama, atau ambil dari transaksi POS yang sudah masuk."
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
                    <TableHead>ProductID</TableHead>
                    <TableHead>Product Code</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Subkategori</TableHead>
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
                        <TableCell className="font-mono">
                          {p.product_code ?? <BelumDiisi />}
                        </TableCell>
                        <TableCell>{p.name}</TableCell>
                        <TableCell>{p.category ?? "—"}</TableCell>
                        <TableCell>{p.subcategory ?? "—"}</TableCell>
                        <TableCell>
                          {p.brand ? (
                            <span className="font-mono">{p.brand.code}</span>
                          ) : (
                            <BelumDiisi />
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
      <ProductImportDialog
        open={imporBuka}
        onClose={() => setImporBuka(false)}
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
        // Backend membedakan bentrok Product Code dari ProductID lewat pesannya.
        setGalat(
          /product code/i.test(error.message)
            ? {
                product_code:
                  "Product Code ini sudah dipakai produk lain, termasuk yang nonaktif.",
              }
            : {
                code: "ProductID ini sudah terdaftar. Aktifkan dari daftar kalau sedang nonaktif.",
              },
        );
        return;
      }
      if (error instanceof ApiError && error.status === 422) {
        const f = error.fieldErrors;
        if (f) {
          setGalat({
            code: f.code ?? null,
            product_code: f.product_code ?? null,
            name: f.name ?? null,
            category: f.category ?? null,
            subcategory: f.subcategory ?? null,
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

    const umum = {
      product_code: isi.product_code,
      name: isi.name,
      brand_id: Number(isi.brand),
      category: isi.category.trim() || null,
      subcategory: isi.subcategory.trim() || null,
      is_active: isi.is_active,
    };

    simpan.mutate(baru ? { code: isi.code, ...umum } : umum);
  }

  const semuaBrand = brands.data ?? [];
  const brandDipilih = semuaBrand.find((b) => String(b.id) === isi.brand);
  const pratinjau = baru ? normalisasiKodeProduk(isi.code) : "";
  const pratinjauProductCode = normalisasiKodeProduk(isi.product_code);

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
                ? "ProductID tidak bisa diganti. Menonaktifkan produk tidak melepas mapping POS-nya."
                : "ProductID dan Product Code disimpan dalam huruf besar. ProductID tidak bisa diganti setelah dibuat."}{" "}
              Kolom bertanda * wajib diisi.
            </DialogDescription>
          </DialogHeader>

          {baru ? (
            <div className="space-y-1.5">
              <Label htmlFor="produk_code">ProductID *</Label>
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
            <Label htmlFor="produk_product_code">Product Code *</Label>
            <Input
              {...atribut("produk_product_code", "product_code")}
              aria-describedby={
                galat.product_code
                  ? "produk_product_code-galat"
                  : pratinjauProductCode &&
                      pratinjauProductCode !== isi.product_code
                    ? "produk_product_code-pratinjau"
                    : undefined
              }
              value={isi.product_code}
              onChange={(e) => ubahField("product_code", e.target.value)}
              placeholder="SKU-001"
              autoComplete="off"
              spellCheck={false}
            />
            {galat.product_code ? (
              <PesanGalat id="produk_product_code" pesan={galat.product_code} />
            ) : pratinjauProductCode &&
              pratinjauProductCode !== isi.product_code ? (
              <p
                id="produk_product_code-pratinjau"
                className="text-muted-foreground text-xs"
              >
                Akan tersimpan sebagai{" "}
                <code className="text-foreground font-mono font-semibold">
                  {pratinjauProductCode}
                </code>
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="produk_name">Nama produk *</Label>
            <Input
              {...atribut("produk_name", "name")}
              value={isi.name}
              onChange={(e) => ubahField("name", e.target.value)}
              placeholder="Red Plate"
              autoComplete="off"
            />
            <PesanGalat id="produk_name" pesan={galat.name} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="produk_brand">Brand *</Label>
            <Select
              value={isi.brand || undefined}
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
                <SelectValue placeholder="Pilih brand" />
              </SelectTrigger>
              <SelectContent>
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
              <Label htmlFor="produk_subcategory">Subkategori</Label>
              <Input
                {...atribut("produk_subcategory", "subcategory")}
                value={isi.subcategory}
                onChange={(e) => ubahField("subcategory", e.target.value)}
                placeholder="Opsional"
                autoComplete="off"
              />
              <PesanGalat id="produk_subcategory" pesan={galat.subcategory} />
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
