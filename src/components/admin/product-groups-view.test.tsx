import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { ProductGroupsView } from "@/components/admin/product-groups-view";

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}));

function mapping(
  id: number,
  product_group: string,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    product_group,
    is_active: true,
    created_at: "2026-09-01T08:00:00",
    updated_at: null,
    ...extra,
  };
}

beforeEach(() => {
  toastError.mockClear();
  toastSuccess.mockClear();
  server.use(
    http.get("/api/product-groups", () =>
      HttpResponse.json({
        success: true,
        data: [
          mapping(1, "COLORPLATE"),
          mapping(2, "PROMO LAMA", { is_active: false }),
        ],
      }),
    ),
    http.get("/api/sales/product-groups", () =>
      HttpResponse.json({
        success: true,
        data: ["COLORPLATE", "MINUMAN", " promo lama"],
      }),
    ),
  );
});

describe("ProductGroupsView — daftar (10.5, 10.8)", () => {
  it("menampilkan semua group termasuk yang nonaktif, status dengan teks", async () => {
    renderWithQuery(<ProductGroupsView />);

    const aktif = (await screen.findByText("COLORPLATE")).closest("tr")!;
    const nonaktif = screen.getByText("PROMO LAMA").closest("tr")!;

    // Ikon + teks, bukan warna saja (8.7).
    expect(within(aktif).getByText("Aktif")).toBeInTheDocument();
    expect(within(nonaktif).getByText("Nonaktif")).toBeInTheDocument();
  });

  it("tidak menawarkan tombol hapus, dan menjelaskan alasannya", async () => {
    renderWithQuery(<ProductGroupsView />);
    await screen.findByText("COLORPLATE");

    expect(
      screen.queryByRole("button", { name: /hapus/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/jejak group/i)).toBeInTheDocument();
  });
});

describe("ProductGroupsView — tambah (10.6, 10.14)", () => {
  it("menampilkan pratinjau bentuk normal sebelum dikirim", async () => {
    renderWithQuery(<ProductGroupsView />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/nama group/i), " colorplate ");

    expect(screen.getByText(/akan tersimpan sebagai/i)).toHaveTextContent(
      "COLORPLATE",
    );
  });

  it("mengirim nama apa adanya — normalisasi tetap urusan backend", async () => {
    let body: unknown = null;
    server.use(
      http.post("/api/product-groups", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { success: true, data: mapping(3, "MINUMAN") },
          { status: 201 },
        );
      }),
    );

    renderWithQuery(<ProductGroupsView />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/nama group/i), "minuman");
    await user.click(screen.getByRole("button", { name: /tambah group/i }));

    await waitFor(() => expect(body).toEqual({ product_group: "minuman" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("409 mengarahkan ke daftar, bukan pesan kesalahan umum (10.14)", async () => {
    server.use(
      http.post("/api/product-groups", () =>
        HttpResponse.json(
          {
            detail:
              "Product group 'PROMO LAMA' sudah terdaftar. Aktifkan lewat PATCH kalau sedang nonaktif.",
          },
          { status: 409 },
        ),
      ),
    );

    renderWithQuery(<ProductGroupsView />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/nama group/i), "promo lama");
    await user.click(screen.getByRole("button", { name: /tambah group/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const [judul, opsi] = toastError.mock.calls.at(-1)!;
    expect(String(judul)).toMatch(/sudah terdaftar/i);
    expect(String((opsi as { description: string }).description)).toMatch(
      /aktifkan dari daftar/i,
    );
    // Istilah API seperti "PATCH" tidak boleh bocor ke user.
    expect(String(judul)).not.toMatch(/patch/i);
  });

  it("nama berisi spasi saja ditolak di field, tanpa request", async () => {
    let dikirim = 0;
    server.use(
      http.post("/api/product-groups", () => {
        dikirim += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    renderWithQuery(<ProductGroupsView />);
    const user = userEvent.setup();

    const input = screen.getByLabelText(/nama group/i);
    await user.type(input, "   ");
    await user.click(screen.getByRole("button", { name: /tambah group/i }));

    expect(await screen.findByText(/wajib diisi/i)).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(dikirim).toBe(0);
  });

  it("422 dari backend tampil di field", async () => {
    server.use(
      http.post("/api/product-groups", () =>
        HttpResponse.json(
          { detail: "product_group maksimal 255 karakter" },
          { status: 422 },
        ),
      ),
    );

    renderWithQuery(<ProductGroupsView />);
    const user = userEvent.setup();

    const input = screen.getByLabelText(/nama group/i);
    await user.type(input, "X");
    await user.click(screen.getByRole("button", { name: /tambah group/i }));

    expect(
      await screen.findByText("product_group maksimal 255 karakter"),
    ).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("menyarankan group dari data penjualan yang belum dipetakan", async () => {
    renderWithQuery(<ProductGroupsView />);
    const user = userEvent.setup();

    const saran = await screen.findByRole("group", { name: /saran/i });
    // PROMO LAMA sudah terdaftar (walau nonaktif), jadi tidak disarankan.
    expect(within(saran).queryByText("PROMO LAMA")).not.toBeInTheDocument();
    expect(within(saran).queryByText("COLORPLATE")).not.toBeInTheDocument();

    await user.click(within(saran).getByRole("button", { name: "MINUMAN" }));

    expect(screen.getByLabelText(/nama group/i)).toHaveValue("MINUMAN");
  });
});

describe("ProductGroupsView — aktif/nonaktif (10.7, 10.15)", () => {
  it("menonaktifkan lewat PATCH setelah konfirmasi, tidak pernah DELETE", async () => {
    const metode: string[] = [];
    const catat = ({ request }: { request: Request }) => {
      metode.push(request.method);
    };
    server.events.on("request:start", catat);

    let patch: { url: string; body: unknown } | null = null;
    server.use(
      http.patch("/api/product-groups/:id", async ({ request }) => {
        patch = { url: request.url, body: await request.json() };
        return HttpResponse.json({
          success: true,
          data: mapping(1, "COLORPLATE", { is_active: false }),
        });
      }),
    );

    try {
      renderWithQuery(<ProductGroupsView />);
      const user = userEvent.setup();

      const baris = (await screen.findByText("COLORPLATE")).closest("tr")!;
      await user.click(
        within(baris).getByRole("button", { name: /^nonaktifkan$/i }),
      );

      const dialog = await screen.findByRole("dialog");
      // Akibatnya disebut: berlaku pada publish berikutnya, ke consumer.
      expect(dialog).toHaveTextContent(/publish berikutnya/i);
      expect(dialog).toHaveTextContent(/consumer/i);
      expect(patch).toBeNull();

      await user.click(
        within(dialog).getByRole("button", { name: /nonaktifkan group/i }),
      );

      await waitFor(() => expect(patch).not.toBeNull());
      expect(new URL(patch!.url).pathname).toBe("/api/product-groups/1");
      expect(patch!.body).toEqual({ is_active: false });
      expect(metode).not.toContain("DELETE");
    } finally {
      server.events.removeListener("request:start", catat);
    }
  });

  it("group nonaktif bisa diaktifkan kembali", async () => {
    let body: unknown = null;
    server.use(
      http.patch("/api/product-groups/:id", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          success: true,
          data: mapping(2, "PROMO LAMA"),
        });
      }),
    );

    renderWithQuery(<ProductGroupsView />);
    const user = userEvent.setup();

    const baris = (await screen.findByText("PROMO LAMA")).closest("tr")!;
    await user.click(
      within(baris).getByRole("button", { name: /^aktifkan$/i }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: /aktifkan group/i }),
    );

    await waitFor(() => expect(body).toEqual({ is_active: true }));
  });
});
