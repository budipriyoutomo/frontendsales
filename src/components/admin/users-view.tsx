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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { api } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/client";
import { formatTanggalWaktu } from "@/lib/format";
import {
  PANJANG_PASSWORD_MINIMAL,
  bolehNonaktifkan,
  validasiUserBaru,
  type GalatForm,
} from "@/lib/user-guard";
import type { UserAdmin } from "@/types/domain";

const ROLE = ["admin", "manager", "outlet"] as const;

export function UsersView({ sayaId }: { sayaId: number }) {
  const qc = useQueryClient();
  const [galat, setGalat] = useState<GalatForm>({});
  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "outlet" as string,
    outlet_code: "",
    full_name: "",
  });
  const [resetUntuk, setResetUntuk] = useState<UserAdmin | null>(null);

  const daftar = useQuery({
    queryKey: ["users"],
    queryFn: () => api.request<UserAdmin[]>("/api/users"),
  });

  const semua = daftar.data ?? [];
  const segarkan = () => qc.invalidateQueries({ queryKey: ["users"] });

  const buat = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.request<UserAdmin>("/api/users", { method: "POST", body: payload }),
    onSuccess: () => {
      setForm({
        email: "",
        password: "",
        role: "outlet",
        outlet_code: "",
        full_name: "",
      });
      setGalat({});
      void segarkan();
      toast.success("Pengguna dibuat.");
    },
    onError: (error) => {
      // 422 dari backend dipetakan ke field yang bersangkutan, supaya
      // pesannya muncul di tempat yang bisa diperbaiki (TODO 6.16).
      if (error instanceof ApiError && error.fieldErrors) {
        setGalat(error.fieldErrors as GalatForm);
        return;
      }
      toast.error(
        error instanceof Error ? error.message : "Gagal membuat pengguna.",
      );
    },
  });

  const ubah = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: number;
      patch: Record<string, unknown>;
    }) => api.request(`/api/users/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => {
      void segarkan();
      toast.success("Perubahan disimpan.");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan perubahan.",
      ),
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      api.request(`/api/users/${id}/password`, {
        method: "POST",
        body: { password },
      }),
    onSuccess: () => {
      setResetUntuk(null);
      toast.success("Kata sandi direset.");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Gagal mereset kata sandi.",
      ),
  });

  function kirimBuat(e: React.FormEvent) {
    e.preventDefault();
    const masalah = validasiUserBaru(form);
    setGalat(masalah);
    if (Object.keys(masalah).length > 0) return;

    buat.mutate({
      email: form.email.trim(),
      password: form.password,
      role: form.role,
      // Field opsional yang kosong tidak dikirim sama sekali.
      ...(form.outlet_code.trim()
        ? { outlet_code: form.outlet_code.trim() }
        : {}),
      ...(form.full_name.trim() ? { full_name: form.full_name.trim() } : {}),
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pengguna</h1>
        <p className="text-muted-foreground text-sm">
          Akun yang bisa masuk ke dashboard ini.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={kirimBuat} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field
                id="email"
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
                galat={galat.email}
              />
              <Field
                id="password"
                label="Kata sandi"
                type="password"
                value={form.password}
                onChange={(v) => setForm({ ...form, password: v })}
                galat={galat.password}
                petunjuk={`Minimal ${PANJANG_PASSWORD_MINIMAL} karakter.`}
              />
              <Field
                id="full_name"
                label="Nama lengkap (opsional)"
                value={form.full_name}
                onChange={(v) => setForm({ ...form, full_name: v })}
              />

              <div className="space-y-1.5">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v })}
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Field
                id="outlet_code"
                label={
                  form.role === "outlet"
                    ? "Kode outlet (wajib)"
                    : "Kode outlet (tidak dipakai)"
                }
                value={form.outlet_code}
                onChange={(v) => setForm({ ...form, outlet_code: v })}
                galat={galat.outlet_code}
                disabled={form.role !== "outlet"}
              />
            </div>

            <Button type="submit" disabled={buat.isPending}>
              {buat.isPending ? "Menyimpan…" : "Buat pengguna"}
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
          ) : semua.length === 0 ? (
            <KeadaanKosong
              judul="Belum ada pengguna"
              keterangan="Buat pengguna pertama lewat form di atas."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {semua.map((u) => {
                    const putusan = bolehNonaktifkan(u, sayaId, semua);
                    const akunSaya = u.id === sayaId;

                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.email}
                          {akunSaya ? (
                            <Badge variant="outline" className="ml-2">
                              Anda
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>{u.full_name ?? "—"}</TableCell>
                        <TableCell>{u.role}</TableCell>
                        <TableCell>{u.outlet_code ?? "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={u.is_active ? "secondary" : "outline"}
                          >
                            {u.is_active ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatTanggalWaktu(u.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setResetUntuk(u)}
                            >
                              Reset sandi
                            </Button>

                            {u.is_active ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!putusan.boleh || ubah.isPending}
                                // Alasan tetap terbaca walau tombolnya mati.
                                title={
                                  putusan.boleh ? undefined : putusan.alasan
                                }
                                onClick={() =>
                                  ubah.mutate({
                                    id: u.id,
                                    patch: { is_active: false },
                                  })
                                }
                              >
                                Nonaktifkan
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={ubah.isPending}
                                onClick={() =>
                                  ubah.mutate({
                                    id: u.id,
                                    patch: { is_active: true },
                                  })
                                }
                              >
                                Aktifkan
                              </Button>
                            )}
                          </div>
                          {!putusan.boleh && u.is_active ? (
                            <p className="text-muted-foreground mt-1 text-xs">
                              {putusan.alasan}
                            </p>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ResetPasswordDialog
        user={resetUntuk}
        sedangProses={resetPassword.isPending}
        onClose={() => setResetUntuk(null)}
        onSimpan={(password) => {
          if (resetUntuk) resetPassword.mutate({ id: resetUntuk.id, password });
        }}
      />
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  galat,
  type = "text",
  petunjuk,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  galat?: string;
  type?: string;
  petunjuk?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={galat ? true : undefined}
        aria-describedby={galat ? `${id}-galat` : undefined}
        autoComplete="off"
      />
      {galat ? (
        <p id={`${id}-galat`} role="alert" className="text-destructive text-xs">
          {galat}
        </p>
      ) : petunjuk ? (
        <p className="text-muted-foreground text-xs">{petunjuk}</p>
      ) : null}
    </div>
  );
}

function ResetPasswordDialog({
  user,
  onClose,
  onSimpan,
  sedangProses,
}: {
  user: UserAdmin | null;
  onClose: () => void;
  onSimpan: (password: string) => void;
  sedangProses: boolean;
}) {
  const [password, setPassword] = useState("");
  const [galat, setGalat] = useState<string | null>(null);

  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open) {
          setPassword("");
          setGalat(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset kata sandi</DialogTitle>
          <DialogDescription>
            Kata sandi baru untuk {user?.email}. Sampaikan lewat jalur yang aman
            — kata sandi ini tidak bisa dilihat lagi setelah ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="password_baru">Kata sandi baru</Label>
          <Input
            id="password_baru"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          {galat ? (
            <p role="alert" className="text-destructive text-xs">
              {galat}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Minimal {PANJANG_PASSWORD_MINIMAL} karakter.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sedangProses}>
            Batal
          </Button>
          <Button
            disabled={sedangProses}
            onClick={() => {
              if (password.length < PANJANG_PASSWORD_MINIMAL) {
                setGalat(
                  `Kata sandi minimal ${PANJANG_PASSWORD_MINIMAL} karakter.`,
                );
                return;
              }
              setGalat(null);
              onSimpan(password);
              setPassword("");
            }}
          >
            {sedangProses ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
