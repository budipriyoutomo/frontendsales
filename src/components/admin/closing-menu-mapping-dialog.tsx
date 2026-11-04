"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useClosingMenu } from "@/hooks/use-closing";
import { api } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/client";
import { formatTanggalWaktuUtc } from "@/lib/format";
import type {
  ClosingMenu,
  ClosingMenuProduct,
  ProductMenuCandidate,
} from "@/types/domain";

const MULTIPLIER_MAKS = 1000;
const JEDA_CARI_MS = 300;

/** `detail.code` 409 backend: tanda "tidak ada di POS" bentrok dengan mapping aktif. */
const KODE_BENTROK = "not_in_pos_conflict";

function multiplierValid(nilai: string) {
  const n = Number(nilai);
  return Number.isInteger(n) && n >= 1 && n <= MULTIPLIER_MAKS;
}

function pesanGagal(error: unknown, cadangan: string) {
  if (error instanceof ApiError) {
    const detail = error.detail as { message?: unknown } | undefined;
    if (detail && typeof detail.message === "string") return detail.message;
  }
  return error instanceof Error ? error.message : cadangan;
}

function bentrok(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    (error.detail as { code?: unknown } | undefined)?.code === KODE_BENTROK
  );
}

/**
 * Pilihan yang menunggu jawaban admin: tanda "tidak ada di POS" dan mapping
 * aktif tidak boleh ada bersamaan, jadi admin memilih salah satunya.
 */
type Konfirmasi =
  | { jenis: "tandai" }
  | { jenis: "tambah"; product_id: number; multiplier: number }
  | { jenis: "aktifkan"; id: number; product_id: number };

type BodyTambah = {
  product_id: number;
  multiplier: number;
  clear_not_in_pos?: boolean;
};
type BodyUbah = {
  multiplier?: number;
  is_active?: boolean;
  clear_not_in_pos?: boolean;
};

/**
 * Mapping satu menu closing ke ProductID POS × pengali — atau tanda "tidak ada
 * di POS" untuk menu Colorplate yang memang tidak dijual di POS.
 *
 * Data menu diambil lewat detailnya, bukan dari daftar yang sedang disaring
 * dan dipaginasi di halaman: menu yang baru dipetakan keluar dari saringan
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
  const detail = useClosingMenu(menuId);
  const menu = detail.data ?? null;

  const [cari, setCari] = useState("");
  const [cariTerkirim, setCariTerkirim] = useState("");
  const [pengaliBaru, setPengaliBaru] = useState<Record<number, string>>({});
  const [ubahan, setUbahan] = useState<Record<number, string>>({});
  const [konfirmasi, setKonfirmasi] = useState<Konfirmasi | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setCariTerkirim(cari.trim()), JEDA_CARI_MS);
    return () => clearTimeout(t);
  }, [cari]);

  const kandidat = useQuery({
    queryKey: ["product-menu-candidates", "", "", cariTerkirim],
    enabled: menuId !== null && cariTerkirim !== "",
    queryFn: ({ signal }) =>
      api.request<ProductMenuCandidate[]>("/api/product-menus/candidates", {
        signal,
        query: { q: cariTerkirim },
      }),
  });

  // Perbandingan & status kirim ikut berubah begitu mapping / tanda berubah.
  const segarkan = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["closing-menus"] }),
      qc.invalidateQueries({ queryKey: ["closing-comparison"] }),
      qc.invalidateQueries({ queryKey: ["closing-export-status"] }),
    ]);

  const tambah = useMutation({
    mutationFn: (body: BodyTambah) =>
      api.request<ClosingMenuProduct>(`/api/closing-menus/${menuId}/products`, {
        method: "POST",
        body,
      }),
    onSuccess: (baru, body) => {
      void segarkan();
      toast.success(
        `${menu?.menu_name ?? "Menu"} dihitung ke ProductID ${baru.product_id} × ${baru.multiplier}.`,
        body.clear_not_in_pos
          ? { description: "Tanda tidak ada di POS dilepas." }
          : undefined,
      );
    },
    onError: (error, body) => {
      if (bentrok(error)) {
        // Menu baru saja ditandai di tempat lain — minta admin memilih.
        void segarkan();
        setKonfirmasi({
          jenis: "tambah",
          product_id: body.product_id,
          multiplier: body.multiplier,
        });
        return;
      }
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
    mutationFn: ({ id, body }: { id: number; body: BodyUbah }) =>
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
    onError: (error, { id }) => {
      if (bentrok(error)) {
        void segarkan();
        const p = menu?.products?.find((x) => x.id === id);
        setKonfirmasi({
          jenis: "aktifkan",
          id,
          product_id: p?.product_id ?? 0,
        });
        return;
      }
      toast.error(pesanGagal(error, "Gagal mengubah mapping."));
    },
  });

  const tandai = useMutation({
    mutationFn: (body: {
      not_in_pos: boolean;
      deactivate_products?: boolean;
    }) =>
      api.request<ClosingMenu>(`/api/closing-menus/${menuId}`, {
        method: "PATCH",
        body,
      }),
    onSuccess: (hasil, body) => {
      void segarkan();
      toast.success(
        hasil.not_in_pos
          ? `${hasil.menu_name} ditandai tidak ada di POS.`
          : `Tanda tidak ada di POS ${hasil.menu_name} dilepas.`,
        body.deactivate_products
          ? { description: "Mapping ProductID-nya dinonaktifkan." }
          : undefined,
      );
    },
    onError: (error) => {
      if (bentrok(error)) {
        // Ada mapping aktif yang belum terlihat di dialog ini.
        void segarkan();
        setKonfirmasi({ jenis: "tandai" });
        return;
      }
      toast.error(pesanGagal(error, "Gagal mengubah tanda menu."));
    },
  });

  const produk = menu?.products ?? [];
  const aktif = produk.filter((p) => p.is_active);
  const sudahDipetakan = new Set(produk.map((p) => p.product_id));
  const tidakAdaDiPos = menu?.not_in_pos ?? false;

  function mintaTandai() {
    if (aktif.length > 0) setKonfirmasi({ jenis: "tandai" });
    else tandai.mutate({ not_in_pos: true });
  }

  function mintaTambah(product_id: number, multiplier: number) {
    if (tidakAdaDiPos)
      setKonfirmasi({ jenis: "tambah", product_id, multiplier });
    else tambah.mutate({ product_id, multiplier });
  }

  function mintaUbahAktif(p: ClosingMenuProduct) {
    if (!p.is_active && tidakAdaDiPos) {
      setKonfirmasi({ jenis: "aktifkan", id: p.id, product_id: p.product_id });
    } else {
      ubah.mutate({ id: p.id, body: { is_active: !p.is_active } });
    }
  }

  function jalankanPilihan() {
    if (!konfirmasi) return;
    if (konfirmasi.jenis === "tandai") {
      tandai.mutate({ not_in_pos: true, deactivate_products: true });
    } else if (konfirmasi.jenis === "tambah") {
      tambah.mutate({
        product_id: konfirmasi.product_id,
        multiplier: konfirmasi.multiplier,
        clear_not_in_pos: true,
      });
    } else {
      ubah.mutate({
        id: konfirmasi.id,
        body: { is_active: true, clear_not_in_pos: true },
      });
    }
    setKonfirmasi(null);
  }

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

        {detail.isPending ? (
          <KartuSkeleton baris={3} />
        ) : (
          <div className="max-h-[70vh] space-y-6 overflow-y-auto">
            <section
              aria-label="Status di POS"
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
            >
              {tidakAdaDiPos ? (
                <div className="text-sm">
                  <div className="font-medium">Tidak ada di POS</div>
                  <div className="text-muted-foreground">
                    Tidak memblokir kirim ke API; terkirim dengan qty POS 0.
                    {menu?.not_in_pos_by
                      ? ` Ditandai ${menu.not_in_pos_by}`
                      : ""}
                    {menu?.not_in_pos_at
                      ? `, ${formatTanggalWaktuUtc(menu.not_in_pos_at)}.`
                      : ""}
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">
                  Menu Colorplate ini memang tidak dijual di POS? Tandai supaya
                  tidak memblokir kirim ke API.
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={tandai.isPending}
                onClick={() =>
                  tidakAdaDiPos
                    ? tandai.mutate({ not_in_pos: false })
                    : mintaTandai()
                }
              >
                {tidakAdaDiPos ? "Lepas tanda" : "Tandai tidak ada di POS"}
              </Button>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">ProductID terpetakan</h3>
              {produk.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {tidakAdaDiPos
                    ? "Tidak ada — menu ini ditandai tidak ada di POS."
                    : "Belum ada. Cari produk POS di bawah lalu tambahkan."}
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
                            onClick={() => mintaUbahAktif(p)}
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
                                mintaTambah(c.product_id, Number(nilai))
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

      <AlertDialog
        open={konfirmasi !== null}
        onOpenChange={(open) => {
          if (!open) setKonfirmasi(null);
        }}
      >
        <AlertDialogContent>
          {konfirmasi?.jenis === "tandai" ? (
            <AlertDialogHeader>
              <AlertDialogTitle>Menu ini masih dipetakan</AlertDialogTitle>
              <AlertDialogDescription>
                {menu?.menu_name ?? "Menu ini"} dihitung dari{" "}
                {aktif.length > 0
                  ? aktif.map((p) => `ProductID ${p.product_id}`).join(", ")
                  : "ProductID POS"}
                . Kalau ditandai tidak ada di POS, mapping itu dinonaktifkan
                (tidak dihapus) dan menu terkirim dengan qty POS 0.
              </AlertDialogDescription>
            </AlertDialogHeader>
          ) : (
            <AlertDialogHeader>
              <AlertDialogTitle>
                Menu ini ditandai tidak ada di POS
              </AlertDialogTitle>
              <AlertDialogDescription>
                Kalau dipetakan ke ProductID {konfirmasi?.product_id}, tanda
                tidak ada di POS dilepas dan qty POS produk itu dihitung untuk{" "}
                {menu?.menu_name ?? "menu ini"}.
              </AlertDialogDescription>
            </AlertDialogHeader>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>
              {konfirmasi?.jenis === "tandai"
                ? "Tetap dipetakan"
                : "Tetap tidak ada di POS"}
            </AlertDialogCancel>
            <AlertDialogAction onClick={jalankanPilihan}>
              {konfirmasi?.jenis === "tandai"
                ? "Tandai tidak ada di POS"
                : `Petakan ke ProductID ${konfirmasi?.product_id ?? ""}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
