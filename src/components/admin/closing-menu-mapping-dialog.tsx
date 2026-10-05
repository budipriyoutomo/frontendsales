"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KartuSkeleton } from "@/components/dashboard/states";
import { useClosingMenus } from "@/hooks/use-closing";
import { api } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/client";
import type { ClosingMenuProduct, ProductMenuCandidate } from "@/types/domain";

const MULTIPLIER_MAKS = 1000;
const JEDA_CARI_MS = 300;

function multiplierValid(nilai: string) {
  const n = Number(nilai);
  return Number.isInteger(n) && n >= 1 && n <= MULTIPLIER_MAKS;
}

function pesanGagal(error: unknown, cadangan: string) {
  return error instanceof Error ? error.message : cadangan;
}

/**
 * Mapping satu menu closing ke ProductID POS × pengali.
 *
 * Data menu diambil dari daftar "semua", bukan dari daftar yang sedang
 * disaring di halaman: menu yang baru dipetakan keluar dari saringan
 * "belum dipetakan", dan dialog tidak boleh ikut tertutup karenanya.
 *
 * Tidak ada hapus — mapping dimatikan, sama seperti mapping lain.
 */
export function ClosingMenuMappingDialog({
  menuId,
  onClose,
}: {
  menuId: number | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const semua = useClosingMenus("all", "");
  const menu = semua.data?.find((m) => m.id === menuId) ?? null;

  const [cari, setCari] = useState("");
  const [cariTerkirim, setCariTerkirim] = useState("");
  const [pengaliBaru, setPengaliBaru] = useState<Record<number, string>>({});
  const [ubahan, setUbahan] = useState<Record<number, string>>({});

  useEffect(() => {
    const t = setTimeout(() => setCariTerkirim(cari.trim()), JEDA_CARI_MS);
    return () => clearTimeout(t);
  }, [cari]);

  const kandidat = useQuery({
    queryKey: ["product-menu-candidates", "", "", cariTerkirim],
    enabled: menuId !== null && cariTerkirim !== "",
    queryFn: () =>
      api.request<ProductMenuCandidate[]>("/api/product-menus/candidates", {
        query: { q: cariTerkirim },
      }),
  });

  const segarkan = () => qc.invalidateQueries({ queryKey: ["closing-menus"] });

  const tambah = useMutation({
    mutationFn: (body: { product_id: number; multiplier: number }) =>
      api.request<ClosingMenuProduct>(`/api/closing-menus/${menuId}/products`, {
        method: "POST",
        body,
      }),
    onSuccess: (baru) => {
      void segarkan();
      toast.success(
        `${menu?.menu_name ?? "Menu"} dihitung ke ProductID ${baru.product_id} × ${baru.multiplier}.`,
      );
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        toast.error("ProductID ini sudah dipetakan ke menu ini", {
          description: "Ubah pengalinya atau aktifkan dari daftar di atas.",
        });
        void segarkan();
        return;
      }
      toast.error(pesanGagal(error, "Gagal menambah mapping."));
    },
  });

  const ubah = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: { multiplier?: number; is_active?: boolean };
    }) =>
      api.request<ClosingMenuProduct>(
        `/api/closing-menus/${menuId}/products/${id}`,
        { method: "PATCH", body },
      ),
    onSuccess: (baris) => {
      setUbahan((u) => {
        const sisa = { ...u };
        delete sisa[baris.id];
        return sisa;
      });
      void segarkan();
      toast.success(
        `ProductID ${baris.product_id} × ${baris.multiplier} ${baris.is_active ? "aktif" : "nonaktif"}.`,
      );
    },
    onError: (error) =>
      toast.error(pesanGagal(error, "Gagal mengubah mapping.")),
  });

  const produk = menu?.products ?? [];
  const sudahDipetakan = new Set(produk.map((p) => p.product_id));

  return (
    <Dialog
      open={menuId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Mapping —{" "}
            {menu
              ? `${menu.menu_name} (${menu.menu_code ?? "tanpa kode"})`
              : "menu"}
          </DialogTitle>
          <DialogDescription>
            Pengali = berapa unit produk POS untuk 1 porsi menu ini. Di laporan
            perbandingan, (terjual + adjustment + kompensasi) × pengali dijumlah
            dengan menu lain yang dipetakan ke produk yang sama.
          </DialogDescription>
        </DialogHeader>

        {semua.isPending ? (
          <KartuSkeleton baris={3} />
        ) : (
          <div className="max-h-[70vh] space-y-6 overflow-y-auto">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">ProductID terpetakan</h3>
              {produk.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Belum ada. Cari produk POS di bawah lalu tambahkan.
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {produk.map((p) => {
                    const nilai = ubahan[p.id] ?? String(p.multiplier);
                    const berubah = nilai !== String(p.multiplier);
                    const sibuk = ubah.isPending && ubah.variables?.id === p.id;
                    const idInput = `pengali-${p.id}`;
                    return (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
                      >
                        <div
                          className={
                            p.is_active ? undefined : "text-muted-foreground"
                          }
                        >
                          <div className="font-medium">
                            {p.product_name?.trim() || "—"}
                          </div>
                          <div className="font-mono text-xs">
                            ProductID {p.product_id}
                            {p.is_active ? "" : " · nonaktif"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={idInput} className="sr-only">
                            Pengali produk {p.product_id}
                          </Label>
                          <span aria-hidden className="text-muted-foreground">
                            ×
                          </span>
                          <Input
                            id={idInput}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={MULTIPLIER_MAKS}
                            className="w-20"
                            value={nilai}
                            onChange={(e) =>
                              setUbahan((u) => ({
                                ...u,
                                [p.id]: e.target.value,
                              }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              !berubah || !multiplierValid(nilai) || sibuk
                            }
                            onClick={() =>
                              ubah.mutate({
                                id: p.id,
                                body: { multiplier: Number(nilai) },
                              })
                            }
                          >
                            Simpan
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={sibuk}
                            onClick={() =>
                              ubah.mutate({
                                id: p.id,
                                body: { is_active: !p.is_active },
                              })
                            }
                          >
                            {p.is_active ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <Label htmlFor="cari-produk-pos">Cari produk POS</Label>
              <Input
                id="cari-produk-pos"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Nama menu POS atau ProductID"
                autoComplete="off"
                spellCheck={false}
              />
              {cariTerkirim === "" ? null : kandidat.isPending ? (
                <KartuSkeleton baris={3} />
              ) : kandidat.isError ? (
                <p role="alert" className="text-destructive text-sm">
                  {pesanGagal(kandidat.error, "Pencarian gagal.")}
                </p>
              ) : kandidat.data.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Tidak ada produk di data penjualan yang cocok.
                </p>
              ) : (
                <ul
                  className="divide-y rounded-md border"
                  aria-label="Hasil pencarian produk POS"
                >
                  {kandidat.data.map((c) => {
                    const terdaftar = sudahDipetakan.has(c.product_id);
                    const nilai = pengaliBaru[c.product_id] ?? "1";
                    const idInput = `pengali-baru-${c.product_id}`;
                    const sibuk =
                      tambah.isPending &&
                      tambah.variables?.product_id === c.product_id;
                    return (
                      <li
                        key={`${c.product_id}-${c.product_group}-${c.product_name}`}
                        className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
                      >
                        <div>
                          <div className="font-medium">
                            {c.product_name?.trim() || "—"}
                          </div>
                          <div className="text-muted-foreground font-mono text-xs">
                            {c.product_id} · {c.product_group ?? "—"} ·{" "}
                            {c.outlet_codes?.join(", ") || "—"}
                          </div>
                        </div>
                        {terdaftar ? (
                          <span className="text-muted-foreground text-sm">
                            Sudah dipetakan
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Label htmlFor={idInput} className="sr-only">
                              Pengali produk {c.product_id}
                            </Label>
                            <span aria-hidden className="text-muted-foreground">
                              ×
                            </span>
                            <Input
                              id={idInput}
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={MULTIPLIER_MAKS}
                              className="w-20"
                              value={nilai}
                              onChange={(e) =>
                                setPengaliBaru((v) => ({
                                  ...v,
                                  [c.product_id]: e.target.value,
                                }))
                              }
                            />
                            <Button
                              size="sm"
                              disabled={!multiplierValid(nilai) || sibuk}
                              onClick={() =>
                                tambah.mutate({
                                  product_id: c.product_id,
                                  multiplier: Number(nilai),
                                })
                              }
                            >
                              Tambahkan
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
