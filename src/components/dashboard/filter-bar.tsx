"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOutlets } from "@/hooks/use-sales";
import { bacaFilter, filterKeSearchParams, rentangDefault } from "@/lib/filter";
import type { Filter } from "@/lib/filter";
import { bolehLihatPemilihOutlet } from "@/lib/auth/access";
import type { Role } from "@/lib/auth/current-user";

/** Nilai sentinel — `Select` tidak menerima item bernilai string kosong. */
const SEMUA_OUTLET = "__semua__";

const PRESET: { label: string; hari: number }[] = [
  { label: "7 hari", hari: 7 },
  { label: "30 hari", hari: 30 },
  { label: "90 hari", hari: 90 },
];

/**
 * Satu baris filter di atas seluruh dashboard (TODO 4.1).
 *
 * Sengaja satu baris global, bukan filter per kartu: semua angka di halaman
 * ini harus menggambarkan irisan data yang sama. Nilainya hidup di URL (4.8)
 * supaya tautannya bisa dibagikan dan tombol back bekerja.
 */
export function FilterBar({ role }: { role: Role }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filter = useMemo(
    () => bacaFilter(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const tampilkanOutlet = bolehLihatPemilihOutlet(role);
  const outlets = useOutlets(tampilkanOutlet);

  function terapkan(berikutnya: Filter) {
    // URL yang berlaku ikut dibawa, supaya group terpilih (10.12) tidak
    // hilang setiap kali tanggal atau outlet diganti.
    const params = filterKeSearchParams(
      berikutnya,
      new URLSearchParams(searchParams.toString()),
    );
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function pakaiPreset(hari: number) {
    const hariIni = new Date();
    const mulai = new Date(
      hariIni.getFullYear(),
      hariIni.getMonth(),
      hariIni.getDate() - (hari - 1),
    );
    const { end_date } = rentangDefault(hariIni);
    terapkan({
      ...filter,
      start_date: `${mulai.getFullYear()}-${String(mulai.getMonth() + 1).padStart(2, "0")}-${String(mulai.getDate()).padStart(2, "0")}`,
      end_date,
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="start_date">Dari tanggal</Label>
        <Input
          id="start_date"
          type="date"
          className="w-40"
          value={filter.start_date}
          max={filter.end_date}
          onChange={(e) => terapkan({ ...filter, start_date: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="end_date">Sampai tanggal</Label>
        <Input
          id="end_date"
          type="date"
          className="w-40"
          value={filter.end_date}
          min={filter.start_date}
          onChange={(e) => terapkan({ ...filter, end_date: e.target.value })}
        />
      </div>

      {tampilkanOutlet ? (
        <div className="space-y-1.5">
          <Label htmlFor="outlet">Outlet</Label>
          <Select
            value={filter.outlet ?? SEMUA_OUTLET}
            onValueChange={(v) =>
              terapkan({
                ...filter,
                outlet: v === SEMUA_OUTLET ? undefined : v,
              })
            }
          >
            <SelectTrigger id="outlet" className="w-48">
              <SelectValue placeholder="Semua outlet" />
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
      ) : null}

      <div className="flex gap-1.5">
        {PRESET.map((p) => (
          <Button
            key={p.hari}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => pakaiPreset(p.hari)}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
