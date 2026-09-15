"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, NetworkError } from "@/lib/api/client";
import { api } from "@/lib/api/browser";

/** Backend menolak kata sandi di bawah 8 karakter — dicegat lebih dulu di sini
 *  supaya user tidak perlu menunggu satu round-trip untuk tahu. */
const PANJANG_MINIMAL = 8;

export function ChangePasswordForm({
  /** True saat user dipaksa ke sini karena passwordnya masih sementara (2.8).
   *  Setelah berhasil, dia diantar keluar — bukan ditinggal di halaman yang
   *  sudah tidak ada urusannya lagi. */
  redirectSetelahSukses = false,
}: {
  redirectSetelahSukses?: boolean;
} = {}) {
  const router = useRouter();
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [ulang, setUlang] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [sukses, setSukses] = useState(false);

  async function kirim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGalat(null);
    setSukses(false);

    if (lama === "" || baru === "") {
      setGalat("Semua field wajib diisi.");
      return;
    }
    if (baru.length < PANJANG_MINIMAL) {
      setGalat(`Kata sandi baru minimal ${PANJANG_MINIMAL} karakter.`);
      return;
    }
    if (baru !== ulang) {
      setGalat("Ulangi kata sandi tidak sama dengan kata sandi baru.");
      return;
    }

    setMengirim(true);
    try {
      await api.request("/api/auth/change-password", {
        method: "POST",
        // `current_password` wajib dikirim — backend memverifikasinya.
        body: { current_password: lama, new_password: baru },
      });

      setSukses(true);
      setLama("");
      setBaru("");
      setUlang("");

      if (redirectSetelahSukses) {
        router.push("/dashboard");
        // `must_change_password` sudah padam di backend; tanpa refresh,
        // layout server masih memakai nilai lama dan memantulkan user
        // kembali ke sini.
        router.refresh();
      }
    } catch (error) {
      if (error instanceof ApiError || error instanceof NetworkError) {
        setGalat(error.message);
      } else {
        setGalat("Terjadi kesalahan yang tidak terduga.");
      }
    } finally {
      setMengirim(false);
    }
  }

  return (
    <form onSubmit={kirim} className="max-w-sm space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="lama">Kata sandi saat ini</Label>
        <Input
          id="lama"
          type="password"
          autoComplete="current-password"
          value={lama}
          onChange={(e) => setLama(e.target.value)}
          disabled={mengirim}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="baru">Kata sandi baru</Label>
        <Input
          id="baru"
          type="password"
          autoComplete="new-password"
          value={baru}
          onChange={(e) => setBaru(e.target.value)}
          disabled={mengirim}
          aria-describedby="petunjuk-panjang"
        />
        <p id="petunjuk-panjang" className="text-muted-foreground text-xs">
          Minimal {PANJANG_MINIMAL} karakter.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ulang">Ulangi kata sandi baru</Label>
        <Input
          id="ulang"
          type="password"
          autoComplete="new-password"
          value={ulang}
          onChange={(e) => setUlang(e.target.value)}
          disabled={mengirim}
        />
      </div>

      {galat ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {galat}
        </p>
      ) : null}

      {sukses ? (
        <p
          role="status"
          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"
        >
          Kata sandi berhasil diganti.
        </p>
      ) : null}

      <Button type="submit" disabled={mengirim}>
        {mengirim ? "Menyimpan…" : "Simpan kata sandi baru"}
      </Button>
    </form>
  );
}
