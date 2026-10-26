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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KartuSkeleton } from "@/components/dashboard/states";
import { useOutlets } from "@/hooks/use-sales";
import { api } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/client";
import { formatTanggal } from "@/lib/format";
import type { PosCandidate, Product } from "@/types/domain";

const JEDA_CARI_MS = 300;
/** Nilai sentinel — `Select` tidak menerima item bernilai string kosong. */
const SEMUA_OUTLET = "__semua__";

function pesanGagal(error: unknown, cadangan: string) {
  return error instanceof Error ? error.message : cadangan;
}

/**
 * Mapping ProductID POS per outlet ke satu produk master.
 *
 * Produk diambil lewat detailnya (bukan dari daftar — daftar dipaginasi, jadi
 * produk ini belum tentu ada di halaman yang termuat). Kuncinya di bawah
 * `["products"]` supaya ikut segar setelah mutasi. Tidak ada hapus — mapping dimatikan; ProductID
 * yang masih aktif di produk lain harus dinonaktifkan dulu di sana.
 */
export function ProductPosMappingDialog({
  productId,
  onClose,
}: {
  productId: number | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const terbuka = productId !== null;

  const detail = useQuery({
    queryKey: ["products", "detail", productId],
    enabled: terbuka,
    queryFn: ({ signal }) =>
      api.request<Product>(`/api/products/${productId}`, { signal }),
  });
  const produk = detail.data ?? null;

  const outlets = useOutlets(terbuka);

  const [outlet, setOutlet] = useState(SEMUA_OUTLET);
  const [cari, setCari] = useState("");
  const [cariTerkirim, setCariTerkirim] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setCariTerkirim(cari.trim()), JEDA_CARI_MS);
    return () => clearTimeout(t);
  }, [cari]);

  const filterOutlet = outlet === SEMUA_OUTLET ? "" : outlet;
  const kandidat = useQuery({
    queryKey: ["product-pos-candidates", filterOutlet, cariTerkirim],
    enabled: terbuka && cariTerkirim !== "",
    queryFn: ({ signal }) =>
      api.request<PosCandidate[]>("/api/products/pos-candidates", {
        signal,
        query: { q: cariTerkirim, outlet: filterOutlet },
      }),
  });

  const segarkan = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["products"] }),
      qc.invalidateQueries({ queryKey: ["product-pos-candidates"] }),
    ]);

  const petakan = useMutation({
    mutationFn: (body: { outlet_code: string; pos_product_id: number }) =>
      api.request<Product>(`/api/products/${productId}/pos-mappings`, {
        method: "POST",
        body,
      }),
    onSuccess: (_hasil, body) => {
      void segarkan();
      toast.success(
        `ProductID ${body.pos_product_id} (${body.outlet_code}) dipetakan ke ${produk?.code ?? "produk"}.`,
      );
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        void segarkan();
      }
      toast.error(pesanGagal(error, "Gagal memetakan ProductID."));
    },
  });

  const ubah = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.request<Product>(`/api/products/${productId}/pos-mappings/${id}`, {
        method: "PATCH",
        body: { is_active },
      }),
    onSuccess: (_hasil, { is_active }) => {
      void segarkan();
      toast.success(`Mapping ${is_active ? "diaktifkan" : "dinonaktifkan"}.`);
    },
    onError: (error) =>
      toast.error(pesanGagal(error, "Gagal mengubah mapping.")),
  });

  const mappings = produk?.pos_mappings ?? [];

  return (
    <Dialog
      open={terbuka}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Mapping POS —{" "}
            {produk ? `${produk.name} (${produk.code})` : "produk"}
          </DialogTitle>
          <DialogDescription>
            Satu ProductID di satu outlet hanya bisa aktif di satu produk. Untuk
            memindahkannya, nonaktifkan dulu di produk lamanya.
          </DialogDescription>
        </DialogHeader>

        {detail.isPending ? (
          <KartuSkeleton baris={3} />
        ) : (
          <div className="max-h-[70vh] space-y-6 overflow-y-auto">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">ProductID terpetakan</h3>
              {mappings.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Belum ada. Cari produk POS di bawah lalu petakan.
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {mappings.map((m) => {
                    const sibuk = ubah.isPending && ubah.variables?.id === m.id;
                    return (
                      <li
                        key={m.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
                      >
                        <div
                          className={
                            m.is_active ? undefined : "text-muted-foreground"
                          }
                        >
                          <div className="font-medium">
                            {m.pos_product_name?.trim() || "—"}
                          </div>
                          <div className="font-mono text-xs">
                            {m.outlet_code} · ProductID {m.pos_product_id}
                            {m.pos_product_group
                              ? ` · ${m.pos_product_group}`
                              : ""}
                            {m.is_active ? "" : " · nonaktif"}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={sibuk}
                          onClick={() =>
                            ubah.mutate({ id: m.id, is_active: !m.is_active })
                          }
                        >
                          {m.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pos-outlet">Outlet</Label>
                  <Select value={outlet} onValueChange={setOutlet}>
                    <SelectTrigger id="pos-outlet" className="w-48">
                      <SelectValue />
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
                <div className="min-w-56 flex-1 space-y-1.5">
                  <Label htmlFor="cari-pos">Cari produk POS</Label>
                  <Input
                    id="cari-pos"
                    value={cari}
                    onChange={(e) => setCari(e.target.value)}
                    placeholder="Nama menu POS atau ProductID"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>

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
                    const sibuk =
                      petakan.isPending &&
                      petakan.variables?.outlet_code === c.outlet_code &&
                      petakan.variables?.pos_product_id === c.pos_product_id;
                    return (
                      <li
                        key={`${c.outlet_code}-${c.pos_product_id}`}
                        className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
                      >
                        <div>
                          <div className="font-medium">
                            {c.pos_product_name?.trim() || "—"}
                          </div>
                          <div className="text-muted-foreground font-mono text-xs">
                            {c.outlet_code} · ProductID {c.pos_product_id} ·{" "}
                            {c.pos_product_group ?? "—"} · terakhir{" "}
                            {formatTanggal(c.last_sale_date)}
                          </div>
                        </div>
                        {c.mapped_product_id === productId ? (
                          <span className="text-muted-foreground text-sm">
                            Sudah di produk ini
                          </span>
                        ) : c.mapped_product_code ? (
                          <span className="text-muted-foreground text-sm">
                            Aktif di{" "}
                            <span className="font-mono">
                              {c.mapped_product_code}
                            </span>
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            disabled={sibuk || !produk?.is_active}
                            onClick={() =>
                              petakan.mutate({
                                outlet_code: c.outlet_code,
                                pos_product_id: c.pos_product_id,
                              })
                            }
                          >
                            Petakan
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {produk && !produk.is_active ? (
                <p className="text-muted-foreground text-sm">
                  Produk ini nonaktif. Aktifkan dulu sebelum memetakan ProductID
                  baru.
                </p>
              ) : null}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
