"use client";

import { useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { PILIHAN_TEMA } from "@/components/tampilan/theme-toggle";
import {
  AKSEN,
  AKSEN_DEFAULT,
  bacaAksenTerpasang,
  langgananAksen,
  simpanAksen,
} from "@/lib/tampilan";
import { cn } from "@/lib/utils";

const KELAS_PILIHAN = cn(
  "relative flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-medium transition-colors",
  "hover:bg-accent/50",
  "has-checked:border-primary has-checked:bg-primary/5",
  "has-focus-visible:outline-ring has-focus-visible:outline-2 has-focus-visible:outline-offset-2",
);

const tanpaLangganan = () => () => {};

export function PengaturanView() {
  const { theme, setTheme } = useTheme();
  // Tema baru diketahui di browser; sebelum itu jangan tandai pilihan apa
  // pun supaya render server dan klien sama.
  const siap = useSyncExternalStore(
    tanpaLangganan,
    () => true,
    () => false,
  );

  const aksen = useSyncExternalStore(
    langgananAksen,
    bacaAksenTerpasang,
    () => AKSEN_DEFAULT,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan"
        description="Tampilan dashboard di browser ini. Pilihan disimpan di perangkat ini saja, tidak ikut ke perangkat lain."
      />

      <Card>
        <CardHeader>
          <CardTitle as="h2">Tema</CardTitle>
          <CardDescription>
            &ldquo;Ikuti sistem&rdquo; mengikuti mode terang/gelap perangkat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset>
            <legend className="sr-only">Tema</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {PILIHAN_TEMA.map(({ value, label, ikon: Ikon }) => (
                <label key={value} className={KELAS_PILIHAN}>
                  <input
                    type="radio"
                    name="tema"
                    value={value}
                    className="sr-only"
                    checked={siap && (theme ?? "system") === value}
                    onChange={() => setTheme(value)}
                  />
                  <Ikon aria-hidden className="text-muted-foreground size-4" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Warna aksen</CardTitle>
          <CardDescription>
            Dipakai untuk tombol utama, menu yang sedang dibuka, dan grafik.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <fieldset>
            <legend className="sr-only">Warna aksen</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {AKSEN.map((a) => (
                <label key={a.id} className={KELAS_PILIHAN}>
                  <input
                    type="radio"
                    name="aksen"
                    value={a.id}
                    className="peer sr-only"
                    checked={aksen === a.id}
                    onChange={() => simpanAksen(a.id)}
                  />
                  <span
                    aria-hidden
                    className="size-5 shrink-0 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: a.contoh }}
                  />
                  {a.label}
                  <Check
                    aria-hidden
                    className="text-primary ml-auto hidden size-4 peer-checked:block"
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">Pratinjau</p>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
              <Button type="button">Tombol utama</Button>
              <Button type="button" variant="outline">
                Tombol biasa
              </Button>
              <span className="text-primary text-sm font-medium">Tautan</span>
              <span
                aria-hidden
                className="h-2 w-24 rounded-full"
                style={{ backgroundColor: "var(--chart-accent)" }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
