"use client";

import { useState } from "react";
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
import { api } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/client";
import type { ProductMenuColorplate, ProductMenuMapping } from "@/types/domain";

const MULTIPLIER_MAKS = 1000;

function kunciWarna(warna: string) {
  return warna.trim().toUpperCase();
}

function multiplierValid(nilai: string) {
  const n = Number(nilai);
  return Number.isInteger(n) && n >= 1 && n <= MULTIPLIER_MAKS;
}

/**
 * Konversi satu menu ke warna colorplate: saat publish, qty menu ×
 * multiplier ditambahkan ke warna tujuan. Contoh "Buy 1 Get 2 RED" → RED × 2.
 *
 * Tidak ada hapus — sama seperti mapping lain, konversi dimatikan.
 */
export function MenuColorplateDialog({
  menu,
  namaMenu,
  onClose,
}: {
  menu: ProductMenuMapping | null;
  namaMenu: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [warnaBaru, setWarnaBaru] = useState("");
  const [multiplierBaru, setMultiplierBaru] = useState("1");
  const [ubahan, setUbahan] = useState<Record<number, string>>({});

  const warna = useQuery({
    queryKey: ["product-menu-platecolors"],
    queryFn: () => api.request<string[]>("/api/product-menus/platecolors"),
    enabled: menu !== null,
  });

  const segarkan = () => qc.invalidateQueries({ queryKey: ["product-menus"] });
  const pesanGagal = (error: unknown, cadangan: string) =>
    error instanceof Error ? error.message : cadangan;

  const tambah = useMutation({
    mutationFn: (body: { platecolor: string; multiplier: number }) =>
      api.request<ProductMenuColorplate>(
        `/api/product-menus/${menu!.id}/colorplates`,
        { method: "POST", body },
      ),
    onSuccess: (baru) => {
      setWarnaBaru("");
      setMultiplierBaru("1");
      void segarkan();
      toast.success(
        `${namaMenu} dihitung sebagai ${baru.platecolor} × ${baru.multiplier}.`,
      );
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        toast.error("Warna ini sudah ada untuk menu ini", {
          description: "Ubah pengalinya atau aktifkan dari daftar di atas.",
        });
        void segarkan();
        return;
      }
      toast.error(pesanGagal(error, "Gagal menambah warna."));
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
      api.request<ProductMenuColorplate>(
        `/api/product-menus/${menu!.id}/colorplates/${id}`,
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
        `${baris.platecolor} × ${baris.multiplier} ${baris.is_active ? "aktif" : "nonaktif"}.`,
      );
    },
    onError: (error) => toast.error(pesanGagal(error, "Gagal mengubah warna.")),
  });

  const konversi = menu?.colorplates ?? [];
  const sudahDipakai = new Set(konversi.map((c) => kunciWarna(c.platecolor)));
  const pilihanWarna = (warna.data ?? []).filter(
    (w) => !sudahDipakai.has(kunciWarna(w)),
  );

  return (
    <Dialog
      open={menu !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Konversi warna — {namaMenu}</DialogTitle>
          <DialogDescription>
            Saat publish, jumlah terjual menu ini dikali pengali lalu
            ditambahkan ke warna colorplate tujuan. Menu tanpa warna aktif tidak
            dipublish.
          </DialogDescription>
        </DialogHeader>

        {konversi.length > 0 && (
          <ul className="divide-y rounded-md border" aria-label="Warna tujuan">
            {konversi.map((c) => {
              const nilai = ubahan[c.id] ?? String(c.multiplier);
              const berubah = nilai !== String(c.multiplier);
              const sibuk = ubah.isPending && ubah.variables?.id === c.id;
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-2 px-3 py-2"
                >
                  <span
                    className={`min-w-24 font-mono font-medium ${c.is_active ? "" : "text-muted-foreground line-through"}`}
                  >
                    {c.platecolor}
                  </span>
                  <span aria-hidden className="text-muted-foreground">
                    ×
                  </span>
                  <Input
                    type="number"
                    min={1}
                    max={MULTIPLIER_MAKS}
                    step={1}
                    inputMode="numeric"
                    className="w-20"
                    aria-label={`Pengali ${c.platecolor}`}
                    value={nilai}
                    onChange={(e) =>
                      setUbahan((u) => ({ ...u, [c.id]: e.target.value }))
                    }
                  />
                  <div className="ml-auto flex gap-2">
                    {berubah && (
                      <Button
                        size="sm"
                        disabled={sibuk || !multiplierValid(nilai)}
                        onClick={() =>
                          ubah.mutate({
                            id: c.id,
                            body: { multiplier: Number(nilai) },
                          })
                        }
                      >
                        Simpan
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={sibuk}
                      onClick={() =>
                        ubah.mutate({
                          id: c.id,
                          body: { is_active: !c.is_active },
                        })
                      }
                    >
                      {c.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!warnaBaru || !multiplierValid(multiplierBaru)) return;
            tambah.mutate({
              platecolor: warnaBaru,
              multiplier: Number(multiplierBaru),
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="warna-baru">Warna</Label>
            <Select value={warnaBaru} onValueChange={setWarnaBaru}>
              <SelectTrigger id="warna-baru" className="w-44">
                <SelectValue
                  placeholder={warna.isPending ? "Memuat…" : "Pilih warna"}
                />
              </SelectTrigger>
              <SelectContent>
                {pilihanWarna.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pengali-baru">Pengali</Label>
            <Input
              id="pengali-baru"
              type="number"
              min={1}
              max={MULTIPLIER_MAKS}
              step={1}
              inputMode="numeric"
              className="w-24"
              value={multiplierBaru}
              onChange={(e) => setMultiplierBaru(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            disabled={
              tambah.isPending || !warnaBaru || !multiplierValid(multiplierBaru)
            }
          >
            Tambah warna
          </Button>
        </form>
        {warna.isSuccess && warna.data.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Belum ada menu COLORPLATE di data penjualan, jadi belum ada warna
            yang bisa dipilih.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
