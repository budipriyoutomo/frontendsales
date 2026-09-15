import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
});

async function isi({
  lama = "lamaSekali1",
  baru = "baruBanget1",
  ulang = "baruBanget1",
}: { lama?: string; baru?: string; ulang?: string } = {}) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/kata sandi saat ini/i), lama);
  await user.type(screen.getByLabelText(/^kata sandi baru/i), baru);
  await user.type(screen.getByLabelText(/ulangi/i), ulang);
  await user.click(screen.getByRole("button", { name: /simpan|ganti/i }));
}

describe("ChangePasswordForm (2.7)", () => {
  it("mengirim current_password dan new_password sesuai kontrak", async () => {
    let dikirim: unknown = null;
    server.use(
      http.post("/api/auth/change-password", async ({ request }) => {
        dikirim = await request.json();
        return HttpResponse.json({ success: true, message: "ok" });
      }),
    );

    render(<ChangePasswordForm />);
    await isi();

    await waitFor(() =>
      expect(dikirim).toEqual({
        current_password: "lamaSekali1",
        new_password: "baruBanget1",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/berhasil/i);
  });

  it("menolak kalau ulangi kata sandi tidak sama, tanpa memanggil API", async () => {
    let dipanggil = 0;
    server.use(
      http.post("/api/auth/change-password", () => {
        dipanggil += 1;
        return HttpResponse.json({ success: true });
      }),
    );

    render(<ChangePasswordForm />);
    await isi({ ulang: "bedaSendiri1" });

    expect(await screen.findByRole("alert")).toHaveTextContent(/tidak sama/i);
    expect(dipanggil).toBe(0);
  });

  it("menolak kata sandi baru di bawah 8 karakter sebelum dikirim", async () => {
    let dipanggil = 0;
    server.use(
      http.post("/api/auth/change-password", () => {
        dipanggil += 1;
        return HttpResponse.json({ success: true });
      }),
    );

    render(<ChangePasswordForm />);
    await isi({ baru: "pendek", ulang: "pendek" });

    expect(await screen.findByRole("alert")).toHaveTextContent(/8 karakter/i);
    expect(dipanggil).toBe(0);
  });

  it("menampilkan pesan server saat kata sandi saat ini salah", async () => {
    server.use(
      http.post("/api/auth/change-password", () =>
        HttpResponse.json(
          { detail: "Kata sandi saat ini salah" },
          { status: 400 },
        ),
      ),
    );

    render(<ChangePasswordForm />);
    await isi();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /kata sandi saat ini salah/i,
    );
  });
});

describe("ChangePasswordForm — penggantian yang dipaksa (2.8)", () => {
  it("mengantar user ke dashboard setelah berhasil", async () => {
    server.use(
      http.post("/api/auth/change-password", () =>
        HttpResponse.json({ success: true, message: "ok" }),
      ),
    );

    render(<ChangePasswordForm redirectSetelahSukses />);
    await isi();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    // Layout server harus membaca ulang `must_change_password` yang kini
    // sudah padam — tanpa refresh, redirect paksa akan memantul lagi.
    expect(refresh).toHaveBeenCalled();
  });

  it("tidak memindahkan halaman saat penggantian biasa", async () => {
    server.use(
      http.post("/api/auth/change-password", () =>
        HttpResponse.json({ success: true, message: "ok" }),
      ),
    );

    render(<ChangePasswordForm />);
    await isi();

    await screen.findByRole("status");
    expect(push).not.toHaveBeenCalled();
  });

  it("tetap di halaman kalau penggantian gagal", async () => {
    server.use(
      http.post("/api/auth/change-password", () =>
        HttpResponse.json(
          { detail: "Kata sandi saat ini salah" },
          { status: 400 },
        ),
      ),
    );

    render(<ChangePasswordForm redirectSetelahSukses />);
    await isi();

    await screen.findByRole("alert");
    expect(push).not.toHaveBeenCalled();
  });
});
