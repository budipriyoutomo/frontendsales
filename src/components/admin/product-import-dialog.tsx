"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { api } from "@/lib/api/browser";
import { formatAngka } from "@/lib/format";
import type { Brand, ImportCandidate, ImportSummary } from "@/types/domain";

const JEDA_CARI_MS = 300;
/** Nilai sentinel — `Select` tidak menerima item bernilai string kosong. */
const SEMUA_BRAND = "__semua__";

const kunci = (c: Pick<ImportCandidate, "brand_id" | "pos_product_id">) =>
  `${c.brand_id}-${c.pos_product_id}`;

function bisaDiimpor(c: ImportCandidate) {
  return c.status !== "bentrok";
}

/**
 * Ambil master data produk dari transaksi POS.
 *
 * Satu baris = satu (brand, ProductID POS): outlet-outlet satu brand yang
 * menjual ProductID yang sama digabung jadi satu produk berkode ProductID POS
 * apa adanya (ProductID & Product Code), Group → Kategori, Dept → Subkategori, lalu
 * semua outlet itu langsung dipetakan. Hanya outlet yang sudah punya brand
 * yang ikut.
 */
export function ProductImportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [brand, setBrand] = useState(SEMUA_BRAND);
  const [cari, setCari] = useState("");
  const [cariTerkirim, setCariTerkirim] = useState("");
  const [dipilih, setDipilih] = useState<Set<string>>(new Set());
  const [hasil, setHasil] = useState<ImportSummary | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setCariTerkirim(cari.trim()), JEDA_CARI_MS);
    return () => clearTimeout(t);
  }, [cari]);

  const brands = useQuery({
    queryKey: ["brands"],
    enabled: open,
    queryFn: () => api.request<Brand[]>("/api/brands"),
  });

  const filterBrand = brand === SEMUA_BRAND ? undefined : brand;
  const kandidat = useQuery({
    queryKey: ["product-import-candidates", filterBrand, cariTerkirim],
    enabled: open,
    placeholderData: (sebelumnya) => sebelumnya,
    queryFn: () =>
      api.request<ImportCandidate[]>("/api/products/import-candidates", {
        query: { brand_id: filterBrand, q: cariTerkirim || undefined },
      }),
  });

  const impor = useMutation({
    mutationFn: (items: { brand_id: number; pos_product_id: number }[]) =>
      api.request<ImportSummary>("/api/products/import", {
        method: "POST",
        body: { items },
      }),
    onSuccess: (ringkasan) => {
      void Promise.all([
        qc.invalidateQueries({ queryKey: ["products"] }),
        qc.invalidateQueries({ queryKey: ["product-import-candidates"] }),
        qc.invalidateQueries({ queryKey: ["product-pos-candidates"] }),
      ]);
      setDipilih(new Set());
      setHasil(ringkasan);
      const tersimpan = ringkasan.created + ringkasan.added;
      if (tersimpan === 0) {
        toast.error("Tidak ada produk yang diimpor.");
      } else {
        toast.success(
          `${formatAngka(ringkasan.created)} produk dibuat, ${formatAngka(ringkasan.added)} ditambah outlet.`,
        );
      }
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Gagal mengimpor produk.",
      ),
  });

  const baris = kandidat.data ?? [];
  const bisa = baris.filter(bisaDiimpor);
  const semuaTerpilih =
    bisa.length > 0 && bisa.every((c) => dipilih.has(kunci(c)));

  function ubahPilih(c: ImportCandidate, pilih: boolean) {
    setDipilih((s) => {
      const baru = new Set(s);
      if (pilih) baru.add(kunci(c));
      else baru.delete(kunci(c));
      return baru;
    });
  }

  function ubahPilihSemua(pilih: boolean) {
    setDipilih((s) => {
      const baru = new Set(s);
      for (const c of bisa) {
        if (pilih) baru.add(kunci(c));
        else baru.delete(kunci(c));
      }
      return baru;
    });
  }

  function kirim() {
    const items = [...dipilih].map((k) => {
      const [brand_id, pos_product_id] = k.split("-").map(Number);
      return { brand_id, pos_product_id };
    });
    impor.mutate(items);
  }

  const semuaBrand = (brands.data ?? []).filter((b) => b.is_active);
  const dilewati = hasil?.results.filter((r) => r.status === "dilewati") ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !impor.isPending) onClose();
      }}
    >
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Ambil dari transaksi</DialogTitle>
          <DialogDescription>
            Produk POS yang belum dipetakan, digabung per brand dan ProductID.
            ProductID dan Product Code produk diambil apa adanya dari ProductID
            di transaksi, Group menjadi Kategori, dan Dept menjadi Subkategori.
            Semua outlet brand itu langsung dipetakan. Hanya outlet yang sudah
            punya brand yang ikut. ProductID yang sama di dua brand hanya bisa
            menjadi satu produk.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="impor-brand">Brand</Label>
            <Select value={brand} onValueChange={setBrand}>
              <SelectTrigger id="impor-brand" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEMUA_BRAND}>Semua brand</SelectItem>
                {semuaBrand.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name} ({b.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="impor-cari">Cari produk POS</Label>
            <Input
              id="impor-cari"
              className="w-72 max-w-full"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Nama atau ProductID"
              autoComplete="off"
            />
          </div>
        </div>

        {dilewati.length > 0 ? (
          <div
            role="status"
            className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
          >
            <p className="font-medium">
              {formatAngka(dilewati.length)} produk dilewati:
            </p>
            <ul className="mt-1 list-disc pl-5">
              {dilewati.map((r) => (
                <li key={kunci(r)}>
                  ProductID {r.pos_product_id} — {r.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="max-h-[55vh] overflow-auto">
          {kandidat.isPending ? (
            <KartuSkeleton baris={5} />
          ) : kandidat.isError ? (
            <KeadaanGagal
              error={kandidat.error}
              onCobaLagi={kandidat.refetch}
            />
          ) : baris.length === 0 ? (
            <KeadaanKosong
              judul="Tidak ada yang bisa diimpor"
              keterangan="Semua produk POS dari outlet yang punya brand sudah dipetakan, atau tidak cocok dengan pencarian."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="accent-primary size-4"
                      aria-label="Pilih semua yang bisa diimpor"
                      checked={semuaTerpilih}
                      disabled={bisa.length === 0}
                      onChange={(e) => ubahPilihSemua(e.target.checked)}
                    />
                  </TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>ProductID POS</TableHead>
                  <TableHead>Nama POS</TableHead>
                  <TableHead>Group / Dept</TableHead>
                  <TableHead>Outlet</TableHead>
                  <TableHead>Hasil</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baris.map((c) => {
                  const sudah =
                    c.outlet_codes.length - c.unmapped_outlet_codes.length;
                  return (
                    <TableRow key={kunci(c)}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="accent-primary size-4"
                          aria-label={`Pilih ${c.brand_code} ProductID ${c.pos_product_id}`}
                          checked={dipilih.has(kunci(c))}
                          disabled={!bisaDiimpor(c)}
                          onChange={(e) => ubahPilih(c, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell className="font-mono">
                        {c.brand_code}
                      </TableCell>
                      <TableCell className="font-mono">
                        {c.pos_product_id}
                      </TableCell>
                      <TableCell>{c.pos_product_name ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {c.pos_product_group ?? "—"} /{" "}
                        {c.pos_product_dept ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="font-mono">
                          {c.unmapped_outlet_codes.join(", ")}
                        </span>
                        {sudah > 0 ? (
                          <div className="text-muted-foreground text-xs">
                            {formatAngka(sudah)} outlet lain sudah dipetakan
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-mono font-medium">
                          {c.proposed_code}
                        </div>
                        {c.status === "baru" ? (
                          <>
                            <div className="text-muted-foreground text-xs">
                              Produk baru
                            </div>
                            {c.reason ? (
                              <div className="text-xs text-amber-800 dark:text-amber-400">
                                {c.reason}
                              </div>
                            ) : null}
                          </>
                        ) : c.status === "tambah_outlet" ? (
                          <div className="text-muted-foreground text-xs">
                            Tambah outlet ke produk yang sudah ada
                          </div>
                        ) : (
                          <div className="text-xs text-amber-800 dark:text-amber-400">
                            Tidak bisa diimpor: {c.reason}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            {formatAngka(dipilih.size)} dipilih
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={impor.isPending}
            >
              Tutup
            </Button>
            <Button
              type="button"
              onClick={kirim}
              disabled={dipilih.size === 0 || impor.isPending}
            >
              {impor.isPending
                ? "Mengimpor…"
                : `Impor (${formatAngka(dipilih.size)})`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
