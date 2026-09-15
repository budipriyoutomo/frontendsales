import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { LoginForm } from "@/components/auth/login-form";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
});

async function isiDanKirim(email = "admin@maharasa.id", password = "rahasia1") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email/i), email);
  await user.type(screen.getByLabelText(/kata sandi/i), password);
  await user.click(screen.getByRole("button", { name: /masuk/i }));
}

describe("LoginForm — login sukses (2.9)", () => {
  it("mengirim kredensial lalu pindah ke dashboard", async () => {
    let dikirim: unknown = null;
    server.use(
      http.post("/api/auth/login", async ({ request }) => {
        dikirim = await request.json();
        return HttpResponse.json({
          user: { id: 1, email: "admin@maharasa.id", role: "admin" },
        });
      }),
    );

    render(<LoginForm />);
    await isiDanKirim();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(dikirim).toEqual({
      email: "admin@maharasa.id",
      password: "rahasia1",
    });
  });

  it("kembali ke halaman yang tadi dituju, bukan selalu dashboard", async () => {
    server.use(
      http.post("/api/auth/login", () => HttpResponse.json({ user: {} })),
    );

    render(<LoginForm nextPath="/transaksi" />);
    await isiDanKirim();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/transaksi"));
  });

  it("mengabaikan tujuan `next` yang mengarah ke luar situs", async () => {
    server.use(
      http.post("/api/auth/login", () => HttpResponse.json({ user: {} })),
    );

    render(<LoginForm nextPath="https://jahat.example/curi" />);
    await isiDanKirim();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
  });
});

describe("LoginForm — kredensial salah (2.10)", () => {
  it("menampilkan pesan dari server dan tidak membuka dashboard", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json(
          { detail: "Email atau kata sandi salah" },
          { status: 401 },
        ),
      ),
    );

    render(<LoginForm />);
    await isiDanKirim();

    expect(
      await screen.findByText(/email atau kata sandi salah/i),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("LoginForm — kena batas percobaan (2.11)", () => {
  it("menampilkan lama tunggu, bukan pesan kredensial salah", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json(
          { detail: "Terlalu banyak percobaan login. Coba lagi nanti." },
          { status: 429, headers: { "Retry-After": "300" } },
        ),
      ),
    );

    render(<LoginForm />);
    await isiDanKirim();

    const pesan = await screen.findByRole("alert");
    // Yang penting user tahu ini soal menunggu, bukan salah password.
    expect(pesan).toHaveTextContent(/5 menit|300 detik/i);
    expect(pesan).not.toHaveTextContent(/kata sandi salah/i);
    expect(push).not.toHaveBeenCalled();
  });

  it("menonaktifkan tombol selama masih harus menunggu", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json(
          { detail: "Terlalu banyak percobaan login." },
          { status: 429, headers: { "Retry-After": "120" } },
        ),
      ),
    );

    render(<LoginForm />);
    await isiDanKirim();

    await screen.findByRole("alert");
    expect(
      screen.getByRole("button", { name: /masuk|tunggu/i }),
    ).toBeDisabled();
  });
});

describe("LoginForm — validasi dasar", () => {
  it("tidak mengirim request saat field masih kosong", async () => {
    let dipanggil = 0;
    server.use(
      http.post("/api/auth/login", () => {
        dipanggil += 1;
        return HttpResponse.json({ user: {} });
      }),
    );

    render(<LoginForm />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /masuk/i }));

    expect(dipanggil).toBe(0);
    expect(push).not.toHaveBeenCalled();
  });
});
