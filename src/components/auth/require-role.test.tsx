import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RequireRole } from "@/components/auth/require-role";
import type { CurrentUser, Role } from "@/lib/auth/current-user";

function user(role: Role): CurrentUser {
  return {
    id: 1,
    email: "u@maharasa.id",
    full_name: null,
    role,
    outlet_code: role === "outlet" ? "OUT1" : null,
    is_active: true,
  };
}

describe("RequireRole (3.3, 3.4, 3.9)", () => {
  it("manager membuka halaman khusus admin mendapat 403 yang jelas, bukan crash (3.9)", () => {
    render(
      <RequireRole user={user("manager")} izinkan={["admin"]}>
        <p>daftar pengguna rahasia</p>
      </RequireRole>,
    );

    expect(
      screen.getByText(/halaman ini tidak untuk anda/i),
    ).toBeInTheDocument();
    // Kontennya tidak boleh ikut terkirim, bukan sekadar disembunyikan.
    expect(
      screen.queryByText(/daftar pengguna rahasia/i),
    ).not.toBeInTheDocument();
  });

  it("menyebut role yang sedang dipakai supaya user paham ini soal hak akses", () => {
    render(
      <RequireRole user={user("manager")} izinkan={["admin"]}>
        <p>isi</p>
      </RequireRole>,
    );

    expect(screen.getByText(/Manager/)).toBeInTheDocument();
  });

  it("menawarkan jalan keluar, bukan layar buntu", () => {
    render(
      <RequireRole user={user("outlet")} izinkan={["admin"]}>
        <p>isi</p>
      </RequireRole>,
    );

    expect(
      screen.getByRole("link", { name: /kembali ke dashboard/i }),
    ).toHaveAttribute("href", "/dashboard");
  });

  it("meloloskan role yang diizinkan", () => {
    render(
      <RequireRole user={user("admin")} izinkan={["admin"]}>
        <p>isi khusus admin</p>
      </RequireRole>,
    );

    expect(screen.getByText("isi khusus admin")).toBeInTheDocument();
  });

  it("mendukung daftar role lebih dari satu", () => {
    render(
      <RequireRole user={user("manager")} izinkan={["admin", "manager"]}>
        <p>isi untuk admin dan manager</p>
      </RequireRole>,
    );

    expect(screen.getByText("isi untuk admin dan manager")).toBeInTheDocument();
  });
});
