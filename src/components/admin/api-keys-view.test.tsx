import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { ApiKeysView } from "@/components/admin/api-keys-view";

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}));

const tulisClipboard = vi.fn(() => Promise.resolve());

function key(outlet: string, extra: Record<string, unknown> = {}) {
  return {
    outlet_code: outlet,
    key_prefix: "mhr_abc",
    is_active: true,
    created_at: "2026-09-01T08:00:00",
    updated_at: null,
    ...extra,
  };
}

beforeEach(() => {
  toastError.mockClear();
  toastSuccess.mockClear();
  tulisClipboard.mockClear();
  server.use(
    http.get("/api/api-keys", () =>
      HttpResponse.json({ success: true, data: [key("OUTLET_001")] }),
    ),
  );
});

describe("ApiKeysView — key sekali-lihat (6.5, 6.12)", () => {
  it("menampilkan key mentah sekali dan bisa disalin", async () => {
    server.use(
      http.post("/api/api-keys", () =>
        HttpResponse.json(
          {
            success: true,
            data: key("OUTLET_002"),
            api_key: "mhr_rahasia_sekali",
          },
          { status: 201 },
        ),
      ),
    );

    renderWithQuery(<ApiKeysView />);
    const user = userEvent.setup();
    // `userEvent.setup()` memasang stub clipboard sendiri, jadi milik kita
    // harus dipasang setelahnya kalau mau yang dipanggil komponen.
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: tulisClipboard },
      configurable: true,
    });

    await user.type(screen.getByLabelText(/kode outlet/i), "OUTLET_002");
    await user.click(screen.getByRole("button", { name: /buat key/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("mhr_rahasia_sekali")).toBeInTheDocument();
    // Peringatan bahwa ini satu-satunya kesempatan harus terlihat.
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      /hanya ditampilkan sekali/i,
    );

    await user.click(
      within(dialog).getByRole("button", { name: /salin api key/i }),
    );
    expect(tulisClipboard).toHaveBeenCalledWith("mhr_rahasia_sekali");
  });

  it("key hilang dari layar setelah dialog ditutup", async () => {
    server.use(
      http.post("/api/api-keys", () =>
        HttpResponse.json(
          { success: true, data: key("OUTLET_002"), api_key: "mhr_sekali" },
          { status: 201 },
        ),
      ),
    );

    renderWithQuery(<ApiKeysView />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/kode outlet/i), "OUTLET_002");
    await user.click(screen.getByRole("button", { name: /buat key/i }));

    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: /sudah menyimpannya/i }),
    );

    await waitFor(() =>
      expect(screen.queryByText("mhr_sekali")).not.toBeInTheDocument(),
    );
  });
});

describe("ApiKeysView — duplikat 409 (6.2, 6.13)", () => {
  it("mengarahkan ke Rotate, bukan pesan kesalahan umum", async () => {
    server.use(
      http.post("/api/api-keys", () =>
        HttpResponse.json(
          { detail: "Outlet sudah memiliki API key" },
          { status: 409 },
        ),
      ),
    );

    renderWithQuery(<ApiKeysView />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/kode outlet/i), "OUTLET_001");
    await user.click(screen.getByRole("button", { name: /buat key/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const [judul, opsi] = toastError.mock.calls.at(-1)!;
    expect(String(judul)).toMatch(/sudah punya api key/i);
    expect(String((opsi as { description: string }).description)).toMatch(
      /rotate/i,
    );
  });
});

describe("ApiKeysView — konfirmasi ketik nama outlet (6.6, 6.14)", () => {
  it("tombol rotate tetap mati sampai kode outlet diketik persis", async () => {
    renderWithQuery(<ApiKeysView />);
    const user = userEvent.setup();

    await screen.findByText("OUTLET_001");
    await user.click(screen.getByRole("button", { name: /rotate/i }));

    const dialog = await screen.findByRole("dialog");
    const tombol = within(dialog).getByRole("button", {
      name: /rotate key/i,
    });

    expect(tombol).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/ketik/i), "OUTLET_00");
    expect(tombol).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/ketik/i), "1");
    expect(tombol).toBeEnabled();
  });

  it("tidak memanggil API sebelum konfirmasi cocok", async () => {
    let dipanggil = 0;
    server.use(
      http.post("/api/api-keys/OUTLET_001/rotate", () => {
        dipanggil += 1;
        return HttpResponse.json({
          success: true,
          data: key("OUTLET_001"),
          api_key: "baru",
        });
      }),
    );

    renderWithQuery(<ApiKeysView />);
    const user = userEvent.setup();

    await screen.findByText("OUTLET_001");
    await user.click(screen.getByRole("button", { name: /rotate/i }));
    await screen.findByRole("dialog");

    expect(dipanggil).toBe(0);
  });

  it("revoke juga butuh konfirmasi ketik", async () => {
    renderWithQuery(<ApiKeysView />);
    const user = userEvent.setup();

    await screen.findByText("OUTLET_001");
    await user.click(screen.getByRole("button", { name: /revoke/i }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: /cabut key/i }),
    ).toBeDisabled();
    expect(within(dialog).getByText(/berhenti bisa mengirim/i)).toBeVisible();
  });
});

describe("ApiKeysView — daftar (6.1)", () => {
  it("hanya menampilkan awalan key, tidak pernah key mentah", async () => {
    renderWithQuery(<ApiKeysView />);

    expect(await screen.findByText("mhr_abc")).toBeInTheDocument();
  });

  it("menonaktifkan revoke untuk key yang sudah dicabut", async () => {
    server.use(
      http.get("/api/api-keys", () =>
        HttpResponse.json({
          success: true,
          data: [key("OUTLET_001", { is_active: false })],
        }),
      ),
    );

    renderWithQuery(<ApiKeysView />);
    await screen.findByText("OUTLET_001");

    expect(screen.getByRole("button", { name: /revoke/i })).toBeDisabled();
  });
});
