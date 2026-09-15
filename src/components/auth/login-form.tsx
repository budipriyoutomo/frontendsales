"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, NetworkError } from "@/lib/api/client";
import { api } from "@/lib/api/browser";
import { formatDurasiTunggu } from "@/lib/format";

/**
 * Form login (TODO 2.1).
 *
 * Diposting ke Route Handler Next, bukan langsung ke FastAPI — token tidak
 * boleh sampai ke JavaScript halaman (keputusan 0.2).
 */

/**
 * `next` datang dari query string, jadi tidak boleh dipercaya: tujuan absolut
 * ke domain lain akan mengubah halaman login jadi alat open-redirect.
 */
function tujuanAman(next: string | undefined): string {
  if (!next) return "/dashboard";
  // Harus path relatif; `//jahat.example` juga absolut bagi browser.
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [tungguDetik, setTungguDetik] = useState(0);

  // Hitung mundur 429: user melihat sisa waktunya berkurang, bukan pesan
  // diam yang tidak jelas kapan berakhirnya (TODO 2.6).
  useEffect(() => {
    if (tungguDetik <= 0) return;
    const t = setInterval(
      () => setTungguDetik((n) => Math.max(0, n - 1)),
      1000,
    );
    return () => clearInterval(t);
  }, [tungguDetik]);

  const terkunci = tungguDetik > 0;

  async function kirim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mengirim || terkunci) return;
    if (email.trim() === "" || password === "") {
      setPesan("Email dan kata sandi wajib diisi.");
      return;
    }

    setMengirim(true);
    setPesan(null);

    try {
      await api.request("/api/auth/login", {
        method: "POST",
        body: { email: email.trim(), password },
      });

      router.push(tujuanAman(nextPath));
      // Layout server perlu membaca cookie sesi yang baru dipasang.
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        const detik = error.retryAfterSeconds ?? 300;
        setTungguDetik(detik);
        setPesan(
          `Terlalu banyak percobaan login. Coba lagi dalam ${formatDurasiTunggu(detik)}.`,
        );
      } else if (error instanceof ApiError) {
        setPesan(error.message);
      } else if (error instanceof NetworkError) {
        setPesan(error.message);
      } else {
        setPesan("Terjadi kesalahan yang tidak terduga.");
      }
    } finally {
      setMengirim(false);
    }
  }

  return (
    <form onSubmit={kirim} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={mengirim}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Kata sandi</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={mengirim}
        />
      </div>

      {pesan ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {terkunci
            ? `Terlalu banyak percobaan login. Coba lagi dalam ${formatDurasiTunggu(tungguDetik)}.`
            : pesan}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={mengirim || terkunci}>
        {terkunci
          ? `Tunggu ${formatDurasiTunggu(tungguDetik)}`
          : mengirim
            ? "Memproses…"
            : "Masuk"}
      </Button>
    </form>
  );
}
