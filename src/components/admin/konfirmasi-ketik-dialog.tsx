"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
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

/**
 * Konfirmasi dengan mengetik ulang nama (TODO 6.6).
 *
 * Rotate dan revoke **langsung mematikan mesin POS di lapangan** — kasir akan
 * berhenti bisa mengirim transaksi begitu tombol ditekan. Klik "Ya" biasa
 * terlalu mudah dilakukan tanpa sadar; mengetik ulang kode outlet memaksa
 * orang membaca outlet mana yang sedang dia sentuh.
 */
export function KonfirmasiKetikDialog({
  terbuka,
  onOpenChange,
  judul,
  keterangan,
  teksKonfirmasi,
  labelAksi,
  sedangProses,
  onKonfirmasi,
}: {
  terbuka: boolean;
  onOpenChange: (open: boolean) => void;
  judul: string;
  keterangan: string;
  /** Teks yang harus diketik ulang — biasanya kode outlet. */
  teksKonfirmasi: string;
  labelAksi: string;
  sedangProses?: boolean;
  onKonfirmasi: () => void;
}) {
  const [ketikan, setKetikan] = useState("");

  // Dialog dipakai ulang untuk outlet yang berbeda — kalau ketikan lama
  // tertinggal, konfirmasinya tidak lagi bermakna. Reset dilakukan saat
  // render (pola "menyesuaikan state saat prop berubah"), bukan di effect:
  // effect baru jalan setelah paint, jadi ada satu frame di mana tombol
  // berbahaya sudah aktif dengan ketikan milik outlet sebelumnya.
  const [sesi, setSesi] = useState({ terbuka, teks: teksKonfirmasi });
  if (sesi.terbuka !== terbuka || sesi.teks !== teksKonfirmasi) {
    setSesi({ terbuka, teks: teksKonfirmasi });
    setKetikan("");
  }

  const cocok = ketikan.trim() === teksKonfirmasi;

  return (
    <Dialog open={terbuka} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle aria-hidden className="text-destructive size-5" />
            {judul}
          </DialogTitle>
          <DialogDescription>{keterangan}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="konfirmasi">
            Ketik{" "}
            <span className="font-mono font-semibold">{teksKonfirmasi}</span>{" "}
            untuk melanjutkan
          </Label>
          <Input
            id="konfirmasi"
            value={ketikan}
            onChange={(e) => setKetikan(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sedangProses}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            disabled={!cocok || sedangProses}
            onClick={onKonfirmasi}
          >
            {sedangProses ? "Memproses…" : labelAksi}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
