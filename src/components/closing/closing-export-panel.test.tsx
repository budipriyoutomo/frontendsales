import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { ClosingExportPanel } from "@/components/closing/closing-export-panel";
import type { Filter } from "@/lib/filter";

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}));

const FILTER: Filter = {
  outlet: "STTSM",
  start_date: "2026-10-01",
  end_date: "2026-10-05",
};

function kiriman(id: number, lain = {}) {
  return {
    id,
    outlet_code: "STTSM",
    production_date: "2026-10-02",
    sequence: id,
    message_id: `6f1c2a7e-3b4d-4e8f-9a10-00000000000${id}`,
    status: "terkirim",
    attempts: 1,
    http_status: 201,
    error: null,
    item_count: 12,
    sent_by: "admin@maharasa.id",
    created_at: "2026-10-03T01:00:00",
    started_at: "2026-10-03T01:00:00",
    finished_at: "2026-10-03T01:00:02",
    ...lain,
  };
}

function pasangan(tanggal: string, lain = {}) {
  return {
    outlet_code: "STTSM",
    production_date: tanggal,
    status: "belum_dikirim",
    can_send: true,
    item_count: 12,
    total_sold: 340,
    menu_belum_dipetakan: [],
    produk_dobel: [],
    last_attempt: null,
    last_sent: null,
    ...lain,
  };
}

const STATUS = [
  pasangan("2026-10-04"),
  pasangan("2026-10-03", {
    status: "perlu_kirim_ulang",
    last_attempt: kiriman(1),
    last_sent: kiriman(1),
  }),
  pasangan("2026-10-02", {
    can_send: false,
    menu_belum_dipetakan: [
      { menu_id: "a", menu_code: "SU-009", menu_name: "Uni Gunkan" },
    ],
    produk_dobel: [
      {
        product_id: 200104,
        product_name: "Salmon HR",
        menus: ["SU-001", "SU-002"],
      },
    ],
  }),
  pasangan("2026-10-01", {
    status: "terkirim",
    last_attempt: kiriman(3, {
      production_date: "2026-10-01",
      status: "gagal",
      http_status: 503,
      error: "HTTP 503",
      attempts: 3,
    }),
    last_sent: kiriman(2, { production_date: "2026-10-01" }),
  }),
];

let permintaanStatus: URLSearchParams[];
let permintaanRiwayat: URLSearchParams[];
let bodyKirim: unknown[];
let ulangi: number[];
let hasilKirim: () => Response;

beforeEach(() => {
  toastError.mockClear();
  toastSuccess.mockClear();
  permintaanStatus = [];
  permintaanRiwayat = [];
  bodyKirim = [];
  ulangi = [];
  hasilKirim = () =>
    HttpResponse.json(
      {
        success: true,
        data: { ...kiriman(9), payload: {}, response_body: "{}" },
      },
      { status: 201 },
    );

  server.use(
    http.get("/api/closing-exports/status", ({ request }) => {
      permintaanStatus.push(new URL(request.url).searchParams);
      return HttpResponse.json({ success: true, data: STATUS });
    }),
    http.get("/api/closing-exports", ({ request }) => {
      permintaanRiwayat.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        success: true,
        data: [
          kiriman(3, {
            status: "gagal",
            http_status: 503,
            error: "HTTP 503",
            attempts: 3,
          }),
          kiriman(1),
        ],
        pagination: { limit: 50, offset: 0, total: 2, has_more: false },
      });
    }),
    http.get("/api/closing-exports/:id", ({ params }) =>
      HttpResponse.json({
        success: true,
        data: {
          ...kiriman(Number(params.id), {
            status: "gagal",
            http_status: 503,
            error: "HTTP 503",
          }),
          payload: {
            messageId: "m-3",
            sequence: 3,
            items: [{ totalSold: 13 }],
          },
          response_body: "maintenance",
        },
      }),
    ),
    http.post("/api/closing-exports", async ({ request }) => {
      bodyKirim.push(await request.json());
      return hasilKirim();
    }),
    http.post("/api/closing-exports/:id/retry", ({ params }) => {
      ulangi.push(Number(params.id));
      return HttpResponse.json({
        success: true,
        data: {
          ...kiriman(Number(params.id)),
          payload: {},
          response_body: null,
        },
      });
    }),
  );
});

function barisTanggal(tanggal: RegExp) {
  const tabel = screen.getByRole("table", { name: /status kirim/i });
  return within(tabel)
    .getAllByRole("row")
    .find((r) => tanggal.test(r.textContent ?? ""))!;
}

async function tampil() {
  renderWithQuery(<ClosingExportPanel filter={FILTER} />);
  await screen.findByRole("table", { name: /status kirim/i });
}

describe("ClosingExportPanel", () => {
  it("meminta status & riwayat sesuai filter outlet dan tanggal produksi", async () => {
    await tampil();

    expect(permintaanStatus[0].get("outlet")).toBe("STTSM");
    expect(permintaanStatus[0].get("start_date")).toBe("2026-10-01");
    expect(permintaanStatus[0].get("end_date")).toBe("2026-10-05");
    await waitFor(() => expect(permintaanRiwayat.length).toBeGreaterThan(0));
    expect(permintaanRiwayat[0].get("outlet")).toBe("STTSM");
    expect(permintaanRiwayat[0].get("offset")).toBe("0");
  });

  it("menampilkan status, item, total sold, dan kiriman terakhir", async () => {
    await tampil();

    const belum = barisTanggal(/4 Okt/);
    expect(within(belum).getByText("Belum dikirim")).toBeInTheDocument();
    expect(within(belum).getByText("340")).toBeInTheDocument();

    expect(
      within(barisTanggal(/3 Okt/)).getByText("Perlu kirim ulang"),
    ).toBeInTheDocument();

    const gagal = barisTanggal(/1 Okt/);
    expect(within(gagal).getByText("Terkirim")).toBeInTheDocument();
    expect(within(gagal).getByText("Gagal")).toBeInTheDocument();
    expect(within(gagal).getByText(/HTTP 503/)).toBeInTheDocument();
  });

  it("baris yang diblokir menyebut alasannya dan tombol kirim mati", async () => {
    await tampil();

    const baris = barisTanggal(/2 Okt/);
    expect(within(baris).getByText(/SU-009/)).toBeInTheDocument();
    expect(within(baris).getByText(/200104/)).toBeInTheDocument();
    expect(within(baris).getByText(/SU-001, SU-002/)).toBeInTheDocument();
    expect(
      within(baris).getByRole("link", { name: /petakan menu/i }),
    ).toHaveAttribute("href", "/closing-menu");
    expect(
      within(baris).getByRole("button", { name: /^kirim/i }),
    ).toBeDisabled();
  });

  it("kirim lewat dialog konfirmasi, lalu status dimuat ulang", async () => {
    const user = userEvent.setup();
    await tampil();
    const sebelum = permintaanStatus.length;

    await user.click(
      within(barisTanggal(/4 Okt/)).getByRole("button", { name: /^kirim/i }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("STTSM")).toBeInTheDocument();
    expect(within(dialog).getByText(/4 Okt/)).toBeInTheDocument();
    expect(within(dialog).getByText("340")).toBeInTheDocument();
    expect(bodyKirim).toEqual([]);

    await user.click(within(dialog).getByRole("button", { name: /^kirim$/i }));

    await waitFor(() =>
      expect(bodyKirim).toEqual([
        { outlet_code: "STTSM", production_date: "2026-10-04" },
      ]),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() =>
      expect(permintaanStatus.length).toBeGreaterThan(sebelum),
    );
  });

  it("perlu kirim ulang memberi tahu di dialog bahwa isinya berubah", async () => {
    const user = userEvent.setup();
    await tampil();

    await user.click(
      within(barisTanggal(/3 Okt/)).getByRole("button", { name: /^kirim/i }),
    );

    expect(
      within(await screen.findByRole("dialog")).getByText(/berubah sejak/i),
    ).toBeInTheDocument();
  });

  it("kiriman yang gagal di API tujuan tampil sebagai error", async () => {
    hasilKirim = () =>
      HttpResponse.json(
        {
          success: true,
          data: {
            ...kiriman(9, {
              status: "gagal",
              http_status: 500,
              error: "HTTP 500",
            }),
            payload: {},
            response_body: "boom",
          },
        },
        { status: 201 },
      );
    const user = userEvent.setup();
    await tampil();

    await user.click(
      within(barisTanggal(/4 Okt/)).getByRole("button", { name: /^kirim/i }),
    );
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: /^kirim$/i,
      }),
    );

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/gagal/i),
        expect.objectContaining({
          description: expect.stringMatching(/HTTP 500/),
        }),
      ),
    );
  });

  it("422 dari backend menampilkan pesan blokirnya", async () => {
    hasilKirim = () =>
      HttpResponse.json(
        {
          detail: {
            message: "Rekap belum bisa dikirim: petakan semua menu.",
            menu_belum_dipetakan: [],
            produk_dobel: [],
          },
        },
        { status: 422 },
      );
    const user = userEvent.setup();
    await tampil();

    await user.click(
      within(barisTanggal(/4 Okt/)).getByRole("button", { name: /^kirim/i }),
    );
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: /^kirim$/i,
      }),
    );

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Rekap belum bisa dikirim: petakan semua menu.",
      ),
    );
  });

  it("503 belum dikonfigurasi menampilkan pesan backend", async () => {
    hasilKirim = () =>
      HttpResponse.json(
        { detail: "Kirim ke API eksternal belum dikonfigurasi." },
        { status: 503 },
      );
    const user = userEvent.setup();
    await tampil();

    await user.click(
      within(barisTanggal(/4 Okt/)).getByRole("button", { name: /^kirim/i }),
    );
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: /^kirim$/i,
      }),
    );

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Kirim ke API eksternal belum dikonfigurasi.",
      ),
    );
  });

  it("kiriman terakhir yang gagal bisa diulang dari tabel status", async () => {
    const user = userEvent.setup();
    await tampil();

    await user.click(
      within(barisTanggal(/1 Okt/)).getByRole("button", { name: /ulangi/i }),
    );

    await waitFor(() => expect(ulangi).toEqual([3]));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("riwayat: detail menampilkan payload dan response, dan bisa diulang", async () => {
    const user = userEvent.setup();
    await tampil();

    const riwayat = await screen.findByRole("table", {
      name: /riwayat kiriman/i,
    });
    const barisGagal = within(riwayat)
      .getAllByRole("row")
      .find((r) => /Gagal/.test(r.textContent ?? ""))!;
    await user.click(
      within(barisGagal).getByRole("button", { name: /detail/i }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText(/"totalSold": 13/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("maintenance")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /ulangi/i }));
    await waitFor(() => expect(ulangi).toEqual([3]));
  });
});
