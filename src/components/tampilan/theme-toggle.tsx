"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const PILIHAN_TEMA = [
  { value: "light", label: "Terang", ikon: Sun },
  { value: "dark", label: "Gelap", ikon: Moon },
  { value: "system", label: "Ikuti sistem", ikon: Monitor },
] as const;

/** Tombol cepat ganti tema di header. Pilihan lengkap ada di Pengaturan. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Ganti tema">
          {/* Ikon dipilih lewat CSS, bukan state, supaya tidak berkedip saat
              hidrasi (tema baru diketahui di browser). */}
          <Sun aria-hidden className="size-5 dark:hidden" />
          <Moon aria-hidden className="hidden size-5 dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme ?? "system"}
          onValueChange={setTheme}
        >
          {PILIHAN_TEMA.map(({ value, label, ikon: Ikon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Ikon aria-hidden className="size-4" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
