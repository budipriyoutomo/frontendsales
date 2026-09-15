"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  KartuSkeleton,
  KeadaanGagal,
  KeadaanKosong,
} from "@/components/dashboard/states";
import { KeyBaruDialog } from "@/components/admin/key-baru-dialog";
import { KonfirmasiKetikDialog } from "@/components/admin/konfirmasi-ketik-dialog";
import { api } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/client";
import { formatTanggalWaktu } from "@/lib/format";
import type { ApiKey } from "@/types/domain";

type KeyBaru = { outletCode: string; apiKey: string };
type Konfirmasi = { aksi: "rotate" | "revoke"; outletCode: string };

/** `api_key` mentah ada di samping `data`, bukan di dalamnya (lihat 6.5). */
function ambilApiKey(body: unknown): string | null {
  if (typeof body === "object" && body !== null && "api_key" in body) {
    const nilai = (body as { api_key: unknown }).api_key;
    return typeof nilai === "string" ? nilai : null;
  }
  return null;
}

export function ApiKeysView() {
  const qc = useQueryClient();
  const [outletBaru, setOutletBaru] = useState("");
  const [keyBaru, setKeyBaru] = useState<KeyBaru | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<Konfirmasi | null>(null);

  const daftar = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api.request<ApiKey[]>("/api/api-keys"),
  });

  const segarkan = () => qc.invalidateQueries({ queryKey: ["api-keys"] });

  const buat = useMutation({
    mutationFn: async (outlet_code: string) => {
      const hasil = await api.requestWithMeta<ApiKey>("/api/api-keys", {
        method: "POST",
        body: { outlet_code },
      });
      return { outlet_code, apiKey: ambilApiKey(hasil.body) };
    },
    onSuccess: ({ outlet_code, apiKey }) => {
      setOutletBaru("");
      void segarkan();
      if (apiKey) setKeyBaru({ outletCode: outlet_code, apiKey });
    },
    onError: (error) => {
      // 409 berarti outletnya sudah punya key — arahkan ke Rotate, jangan
      // biarkan tampil sebagai "terjadi kesalahan" (TODO 6.2).
      if (error instanceof ApiError && error.status === 409) {
        toast.error("Outlet ini sudah punya API key", {
          description:
            "Gunakan tombol Rotate pada barisnya untuk mengganti key yang ada.",
        });
        return;
      }
      toast.error(
        error instanceof Error ? error.message : "Gagal membuat key.",
      );
    },
  });

  const rotate = useMutation({
    mutationFn: async (outlet_code: string) => {
      const hasil = await api.requestWithMeta<ApiKey>(
        `/api/api-keys/${encodeURIComponent(outlet_code)}/rotate`,
        { method: "POST" },
      );
      return { outlet_code, apiKey: ambilApiKey(hasil.body) };
    },
    onSuccess: ({ outlet_code, apiKey }) => {
      setKonfirmasi(null);
      void segarkan();
      if (apiKey) setKeyBaru({ outletCode: outlet_code, apiKey });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Rotate gagal."),
  });

  const revoke = useMutation({
    mutationFn: (outlet_code: string) =>
      api.request(`/api/api-keys/${encodeURIComponent(outlet_code)}/revoke`, {
        method: "POST",
      }),
    onSuccess: () => {
      setKonfirmasi(null);
      void segarkan();
      toast.success("API key dicabut. POS outlet ini berhenti mengirim data.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Revoke gagal."),
  });

  const sedangProses = rotate.isPending || revoke.isPending;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">API Key</h1>
        <p className="text-muted-foreground text-sm">
          Kunci yang dipakai mesin POS tiap outlet untuk mengirim transaksi.
          Daftar ini hanya menampilkan awalan key — nilai penuhnya tidak
          disimpan di server.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const kode = outletBaru.trim();
              if (kode) buat.mutate(kode);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="outlet_baru">Kode outlet</Label>
              <Input
                id="outlet_baru"
                className="w-56"
                value={outletBaru}
                onChange={(e) => setOutletBaru(e.target.value)}
                placeholder="OUTLET_001"
                autoComplete="off"
              />
            </div>
            <Button
              type="submit"
              disabled={buat.isPending || outletBaru.trim() === ""}
            >
              {buat.isPending ? "Membuat…" : "Buat key"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {daftar.isPending ? (
            <KartuSkeleton baris={5} />
          ) : daftar.isError ? (
            <KeadaanGagal error={daftar.error} onCobaLagi={daftar.refetch} />
          ) : (daftar.data ?? []).length === 0 ? (
            <KeadaanKosong
              judul="Belum ada API key"
              keterangan="Buat key pertama dengan mengisi kode outlet di atas."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Awalan key</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(daftar.data ?? []).map((k) => (
                    <TableRow key={k.outlet_code}>
                      <TableCell className="font-medium">
                        {k.outlet_code}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {k.key_prefix ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={k.is_active ? "secondary" : "outline"}>
                          {k.is_active ? "Aktif" : "Dicabut"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatTanggalWaktu(k.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setKonfirmasi({
                                aksi: "rotate",
                                outletCode: k.outlet_code,
                              })
                            }
                          >
                            Rotate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!k.is_active}
                            onClick={() =>
                              setKonfirmasi({
                                aksi: "revoke",
                                outletCode: k.outlet_code,
                              })
                            }
                          >
                            Revoke
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <KonfirmasiKetikDialog
        terbuka={konfirmasi !== null}
        onOpenChange={(open) => {
          if (!open) setKonfirmasi(null);
        }}
        judul={
          konfirmasi?.aksi === "revoke" ? "Cabut API key" : "Rotate API key"
        }
        keterangan={
          konfirmasi?.aksi === "revoke"
            ? `POS di outlet ${konfirmasi?.outletCode} akan langsung berhenti bisa mengirim transaksi, dan tidak ada key pengganti.`
            : `Key lama outlet ${konfirmasi?.outletCode} langsung tidak berlaku. POS di sana berhenti mengirim data sampai key baru dipasang.`
        }
        teksKonfirmasi={konfirmasi?.outletCode ?? ""}
        labelAksi={konfirmasi?.aksi === "revoke" ? "Cabut key" : "Rotate key"}
        sedangProses={sedangProses}
        onKonfirmasi={() => {
          if (!konfirmasi) return;
          if (konfirmasi.aksi === "rotate")
            rotate.mutate(konfirmasi.outletCode);
          else revoke.mutate(konfirmasi.outletCode);
        }}
      />

      <KeyBaruDialog
        outletCode={keyBaru?.outletCode ?? null}
        apiKey={keyBaru?.apiKey ?? null}
        onClose={() => setKeyBaru(null)}
      />
    </div>
  );
}
