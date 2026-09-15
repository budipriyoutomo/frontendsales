import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { UsersView } from "@/components/admin/users-view";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function user(id: number, role: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    email: `u${id}@maharasa.id`,
    full_name: null,
    role,
    outlet_code: null,
    is_active: true,
    created_at: "2026-09-01T08:00:00",
    updated_at: null,
    ...extra,
  };
}

function daftar(rows: Record<string, unknown>[]) {
  return http.get("/api/users", () =>
    HttpResponse.json({ success: true, data: rows }),
  );
}

beforeEach(() => {
  server.use(daftar([user(1, "admin"), user(2, "manager")]));
});

describe("UsersView — daftar (6.7)", () => {
  it("menampilkan pengguna dari API", async () => {
    renderWithQuery(<UsersView sayaId={1} />);

    expect(await screen.findByText("u1@maharasa.id")).toBeInTheDocument();
    expect(screen.getByText("u2@maharasa.id")).toBeInTheDocument();
  });

  it("menandai baris akun sendiri", async () => {
    renderWithQuery(<UsersView sayaId={1} />);

    const baris = (await screen.findByText("u1@maharasa.id")).closest("tr")!;
    expect(within(baris).getByText("Anda")).toBeInTheDocument();
  });
});

describe("UsersView — pagar backend jadi UI (6.11, 6.15)", () => {
  it("tombol nonaktifkan mati untuk akun sendiri (6.15)", async () => {
    renderWithQuery(<UsersView sayaId={1} />);

    const baris = (await screen.findByText("u1@maharasa.id")).closest("tr")!;
    const tombol = within(baris).getByRole("button", {
      name: /nonaktifkan/i,
    });

    expect(tombol).toBeDisabled();
    // Alasannya ikut ditulis, bukan tombol mati tanpa penjelasan.
    expect(baris.textContent).toMatch(/akun Anda sendiri/i);
  });

  it("tombol nonaktifkan mati untuk admin aktif terakhir", async () => {
    server.use(daftar([user(1, "manager"), user(2, "admin")]));

    renderWithQuery(<UsersView sayaId={1} />);

    const baris = (await screen.findByText("u2@maharasa.id")).closest("tr")!;
    expect(
      within(baris).getByRole("button", { name: /nonaktifkan/i }),
    ).toBeDisabled();
    expect(baris.textContent).toMatch(/admin aktif terakhir/i);
  });

  it("tombol nonaktifkan hidup untuk user lain yang aman", async () => {
    renderWithQuery(<UsersView sayaId={1} />);

    const baris = (await screen.findByText("u2@maharasa.id")).closest("tr")!;
    expect(
      within(baris).getByRole("button", { name: /nonaktifkan/i }),
    ).toBeEnabled();
  });

  it("mengirim PATCH is_active saat menonaktifkan", async () => {
    let dikirim: unknown = null;
    server.use(
      http.patch("/api/users/2", async ({ request }) => {
        dikirim = await request.json();
        return HttpResponse.json({ success: true, data: user(2, "manager") });
      }),
    );

    renderWithQuery(<UsersView sayaId={1} />);
    const baris = (await screen.findByText("u2@maharasa.id")).closest("tr")!;

    await userEvent
      .setup()
      .click(within(baris).getByRole("button", { name: /nonaktifkan/i }));

    await waitFor(() => expect(dikirim).toEqual({ is_active: false }));
  });
});

describe("UsersView — buat pengguna (6.8, 6.16)", () => {
  it("role outlet tanpa kode outlet memunculkan pesan di field (6.16)", async () => {
    let dipanggil = 0;
    server.use(
      http.post("/api/users", () => {
        dipanggil += 1;
        return HttpResponse.json({ success: true, data: user(9, "outlet") });
      }),
    );

    renderWithQuery(<UsersView sayaId={1} />);
    const user_ = userEvent.setup();

    await user_.type(screen.getByLabelText("Email"), "baru@maharasa.id");
    await user_.type(screen.getByLabelText(/kata sandi/i), "rahasia123");
    // Role default sudah "outlet"; kode outlet sengaja dibiarkan kosong.
    await user_.click(screen.getByRole("button", { name: /buat pengguna/i }));

    const pesan = await screen.findByRole("alert");
    expect(pesan).toHaveTextContent(/wajib punya kode outlet/i);
    // Tidak menembak API untuk sesuatu yang pasti ditolak 422.
    expect(dipanggil).toBe(0);
  });

  it("mengirim payload lengkap saat isian benar", async () => {
    let dikirim: unknown = null;
    server.use(
      http.post("/api/users", async ({ request }) => {
        dikirim = await request.json();
        return HttpResponse.json(
          { success: true, data: user(9, "outlet") },
          { status: 201 },
        );
      }),
    );

    renderWithQuery(<UsersView sayaId={1} />);
    const user_ = userEvent.setup();

    await user_.type(screen.getByLabelText("Email"), "baru@maharasa.id");
    await user_.type(screen.getByLabelText(/kata sandi/i), "rahasia123");
    await user_.type(screen.getByLabelText(/kode outlet/i), "OUTLET_009");
    await user_.click(screen.getByRole("button", { name: /buat pengguna/i }));

    await waitFor(() =>
      expect(dikirim).toEqual({
        email: "baru@maharasa.id",
        password: "rahasia123",
        role: "outlet",
        outlet_code: "OUTLET_009",
      }),
    );
  });

  it("menolak kata sandi di bawah 8 karakter sebelum menembak API", async () => {
    let dipanggil = 0;
    server.use(
      http.post("/api/users", () => {
        dipanggil += 1;
        return HttpResponse.json({ success: true, data: user(9, "admin") });
      }),
    );

    renderWithQuery(<UsersView sayaId={1} />);
    const user_ = userEvent.setup();

    await user_.type(screen.getByLabelText("Email"), "baru@maharasa.id");
    await user_.type(screen.getByLabelText(/kata sandi/i), "pendek");
    await user_.type(screen.getByLabelText(/kode outlet/i), "OUT1");
    await user_.click(screen.getByRole("button", { name: /buat pengguna/i }));

    expect(await screen.findByText(/minimal 8 karakter/i)).toBeInTheDocument();
    expect(dipanggil).toBe(0);
  });

  it("memetakan 422 dari backend ke field yang bersangkutan", async () => {
    server.use(
      http.post("/api/users", () =>
        HttpResponse.json(
          {
            detail: [
              {
                loc: ["body", "email"],
                msg: "Email sudah dipakai",
                type: "value_error",
              },
            ],
          },
          { status: 422 },
        ),
      ),
    );

    renderWithQuery(<UsersView sayaId={1} />);
    const user_ = userEvent.setup();

    await user_.type(screen.getByLabelText("Email"), "ada@maharasa.id");
    await user_.type(screen.getByLabelText(/kata sandi/i), "rahasia123");
    await user_.type(screen.getByLabelText(/kode outlet/i), "OUT1");
    await user_.click(screen.getByRole("button", { name: /buat pengguna/i }));

    expect(await screen.findByText(/email sudah dipakai/i)).toBeInTheDocument();
  });
});

describe("UsersView — reset kata sandi (6.10)", () => {
  it("mengirim kata sandi baru ke endpoint reset", async () => {
    let dikirim: unknown = null;
    server.use(
      http.post("/api/users/2/password", async ({ request }) => {
        dikirim = await request.json();
        return HttpResponse.json({ success: true, message: "ok" });
      }),
    );

    renderWithQuery(<UsersView sayaId={1} />);
    const user_ = userEvent.setup();

    const baris = (await screen.findByText("u2@maharasa.id")).closest("tr")!;
    await user_.click(
      within(baris).getByRole("button", { name: /reset sandi/i }),
    );

    const dialog = await screen.findByRole("dialog");
    await user_.type(
      within(dialog).getByLabelText(/kata sandi baru/i),
      "sandibaru123",
    );
    await user_.click(within(dialog).getByRole("button", { name: /simpan/i }));

    await waitFor(() => expect(dikirim).toEqual({ password: "sandibaru123" }));
  });

  it("menolak kata sandi pendek tanpa memanggil API", async () => {
    let dipanggil = 0;
    server.use(
      http.post("/api/users/2/password", () => {
        dipanggil += 1;
        return HttpResponse.json({ success: true, message: "ok" });
      }),
    );

    renderWithQuery(<UsersView sayaId={1} />);
    const user_ = userEvent.setup();

    const baris = (await screen.findByText("u2@maharasa.id")).closest("tr")!;
    await user_.click(
      within(baris).getByRole("button", { name: /reset sandi/i }),
    );

    const dialog = await screen.findByRole("dialog");
    await user_.type(within(dialog).getByLabelText(/kata sandi baru/i), "abc");
    await user_.click(within(dialog).getByRole("button", { name: /simpan/i }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /minimal 8 karakter/i,
    );
    expect(dipanggil).toBe(0);
  });
});
