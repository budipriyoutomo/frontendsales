"use client";

import { useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Dialog key sekali-lihat (TODO 6.5).
 *
 * `create` dan `rotate` adalah **satu-satunya** response yang memuat key
 * mentah — backend hanya menyimpan hashnya. Begitu dialog ini ditutup,
 * nilainya hilang selamanya dan satu-satunya jalan adalah rotate lagi,
 * yang berarti mematikan POS outlet itu sekali lagi.
 */
export function KeyBaruDialog({
  outletCode,
  apiKey,
  onClose,
}: {
  outletCode: string | null;
  apiKey: string | null;
  onClose: () => void;
}) {
  const [tersalin, setTersalin] = useState(false);

  async function salin() {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      // Clipboard bisa ditolak browser (konteks tidak aman). Key tetap
      // terlihat di layar dan bisa diblok-salin manual.
      setTersalin(false);
    }
  }

  return (
    <Dialog
      open={apiKey !== null}
      onOpenChange={(open) => {
        if (!open) {
          setTersalin(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>API key untuk {outletCode}</DialogTitle>
          <DialogDescription>
            Salin sekarang dan simpan di tempat aman.
          </DialogDescription>
        </DialogHeader>

        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 flex gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <TriangleAlert
            aria-hidden
            className="text-destructive mt-0.5 size-4 shrink-0"
          />
          <p>
            Key ini <strong>hanya ditampilkan sekali</strong>. Setelah dialog
            ditutup, nilainya tidak bisa dilihat lagi — satu-satunya cara
            mendapatkan yang baru adalah rotate, dan itu mematikan POS outlet
            ini sampai key baru dipasang.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <code className="bg-muted min-w-0 flex-1 overflow-x-auto rounded-md px-3 py-2 font-mono text-sm break-all">
            {apiKey}
          </code>
          <Button
            variant="outline"
            size="icon"
            onClick={salin}
            aria-label="Salin API key"
          >
            {tersalin ? (
              <Check aria-hidden className="size-4" />
            ) : (
              <Copy aria-hidden className="size-4" />
            )}
          </Button>
        </div>

        {tersalin ? (
          <p role="status" className="text-muted-foreground text-sm">
            Key tersalin ke clipboard.
          </p>
        ) : null}

        <DialogFooter>
          <Button onClick={onClose}>Saya sudah menyimpannya</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
