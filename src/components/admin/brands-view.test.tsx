import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { BrandsView } from "@/components/admin/brands-view";

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}));

function brand(
  id: number,
  code: string,
  name: string,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    code,
    name,
    is_active: true,
    outlet_codes: [],
    created_at: "2026-09-01T08:00:00",
    updated_at: null,
    ...extra,
  };
}

beforeEach(() => {
  toastError.mockClear();
  toastSuccess.mockClear();
  server.use(
    http.get("/api/brands", () =>
      HttpResponse.json({
        success: true,
        data: [
          brand(1, "MHR", "Maharasa", { outlet_codes: ["OUT1"] }),
          brand(2, "OLD", "Brand Lama", { is_active: false }),
        ],
      }),
    ),
    http.get("/api/brands/outlets", () =>
      HttpResponse.json({
        success: true,
        data: [
          {
            outlet_code: "OUT1",
            is_active: true,
            brand_id: 1,
            brand_code: "MHR",
            brand_name: "Maharasa",
          },
          {
            outlet_code: "OUT2",
            is_active: true,
            brand_id: null,
            brand_code: null,
            brand_name: null,
          },
        ],
      }),
    ),
  );
});

describe("BrandsView — daftar brand", () => {
  it("menampilkan brand beserta outlet dan statusnya", async () => {
    renderWithQuery(<BrandsView />);

    const mhr = (await screen.findByText("Maharasa")).closest("tr")!;
    expect(within(mhr).getByText("OUT1")).toBeInTheDocument();
    expect(within(mhr).getByText("Aktif")).toBeInTheDocument();

    const lama = screen.getByText("Brand Lama").closest("tr")!;
    expect(within(lama).getByText("Nonaktif")).toBeInTheDocument();
    expect(within(lama).getByText("Belum ada")).toBeInTheDocument();
  });

  it("tidak menawarkan tombol hapus", async () => {
    renderWithQuery(<BrandsView />);
    await screen.findByText("Maharasa");

    expect(
      screen.queryByRole("button", { name: /hapus/i }),
    ).not.toBeInTheDocument();
  });
});

describe("BrandsView — tambah brand", () => {
  it("menampilkan pratinjau kode dan mengirim input apa adanya", async () => {
    let body: unknown = null;
    server.use(
      http.post("/api/brands", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { success: true, data: brand(3, "BRU", "Baru") },
          { status: 201 },
        );
      }),
    );

    renderWithQuery(<BrandsView />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Kode"), " bru");
    expect(screen.getByText(/akan tersimpan sebagai/i)).toHaveTextContent(
      "BRU",
    );
    await user.type(screen.getByLabelText("Nama brand"), "Baru");
    await user.click(screen.getByRole("button", { name: /tambah brand/i }));

    await waitFor(() => expect(body).toEqual({ code: " bru", name: "Baru" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("validasi di browser mencegah request kosong", async () => {
    let diminta = 0;
    server.use(
      http.post("/api/brands", () => {
        diminta += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    renderWithQuery(<BrandsView />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /tambah brand/i }));

    expect(await screen.findByText(/kode brand wajib/i)).toBeInTheDocument();
    expect(screen.getByText(/nama brand wajib/i)).toBeInTheDocument();
    expect(diminta).toBe(0);
  });

  it("409 ditempel di field kode", async () => {
    server.use(
      http.post("/api/brands", () =>
        HttpResponse.json(
          { detail: "Brand 'MHR' sudah terdaftar." },
          { status: 409 },
        ),
      ),
    );

    renderWithQuery(<BrandsView />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Kode"), "mhr");
    await user.type(screen.getByLabelText("Nama brand"), "Lagi");
    await user.click(screen.getByRole("button", { name: /tambah brand/i }));

    expect(await screen.findByText(/sudah terdaftar/i)).toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
  });
});

describe("BrandsView — ubah brand", () => {
  it("mengirim nama dan status baru lewat PATCH", async () => {
    let body: unknown = null;
    server.use(
      http.patch("/api/brands/1", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          success: true,
          data: brand(1, "MHR", "Maharasa Group", { is_active: false }),
        });
      }),
    );

    renderWithQuery(<BrandsView />);
    const user = userEvent.setup();

    const mhr = (await screen.findByText("Maharasa")).closest("tr")!;
    await user.click(within(mhr).getByRole("button", { name: "Ubah" }));

    const dialog = await screen.findByRole("dialog");
    const nama = within(dialog).getByLabelText("Nama brand");
    await user.clear(nama);
    await user.type(nama, "Maharasa Group");
    await user.click(within(dialog).getByRole("switch", { name: "Aktif" }));
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(body).toEqual({ name: "Maharasa Group", is_active: false }),
    );
  });
});

describe("BrandsView — outlet per brand", () => {
  it("memetakan outlet ke brand aktif lewat PUT", async () => {
    let body: unknown = null;
    server.use(
      http.put("/api/brands/outlets/OUT2", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          success: true,
          data: {
            outlet_code: "OUT2",
            is_active: true,
            brand_id: 1,
            brand_code: "MHR",
            brand_name: "Maharasa",
          },
        });
      }),
    );

    renderWithQuery(<BrandsView />);
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("combobox", { name: "Brand untuk OUT2" }),
    );
    // Brand nonaktif tidak ditawarkan.
    expect(
      screen.queryByRole("option", { name: /Brand Lama/ }),
    ).not.toBeInTheDocument();
    await user.click(
      await screen.findByRole("option", { name: "Maharasa (MHR)" }),
    );

    await waitFor(() => expect(body).toEqual({ brand_id: 1 }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("melepas outlet dari brand mengirim brand_id null", async () => {
    let body: unknown = null;
    server.use(
      http.put("/api/brands/outlets/OUT1", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          success: true,
          data: {
            outlet_code: "OUT1",
            is_active: true,
            brand_id: null,
            brand_code: null,
            brand_name: null,
          },
        });
      }),
    );

    renderWithQuery(<BrandsView />);
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("combobox", { name: "Brand untuk OUT1" }),
    );
    await user.click(
      await screen.findByRole("option", { name: "Tanpa brand" }),
    );

    await waitFor(() => expect(body).toEqual({ brand_id: null }));
  });
});
