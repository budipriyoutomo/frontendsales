import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { ClosingMessagesView } from "@/components/admin/closing-messages-view";

const REPORT_ID = "6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b";

function log(id: number, status: string, lain = {}) {
  return {
    id,
    received_at: "2026-10-02T15:15:02",
    status,
    reason: null,
    warnings: null,
    message_id: `pesan-${id}`,
    outlet_code: "STTSM",
    closing_report_id: REPORT_ID,
    report_date: "2026-10-02",
    item_count: 12,
    revision_id: 1,
    body_bytes: 2048,
    ...lain,
  };
}

const DAFTAR = [
  log(3, "ditolak", {
    reason: "gagal validasi",
    closing_report_id: null,
    report_date: null,
    item_count: null,
    revision_id: null,
  }),
  log(2, "duplikat"),
  log(1, "baru", {
    warnings: ["outlet belum terdaftar di api_keys"],
  }),
];

const PAYLOAD = { messageId: "pesan-3", version: 2 };

let permintaan: URLSearchParams[];

beforeEach(() => {
  permintaan = [];
  server.use(
    http.get("/api/closing-messages", ({ request }) => {
      const params = new URL(request.url).searchParams;
      permintaan.push(params);
      const status = params.get("status");
      const data = status ? DAFTAR.filter((d) => d.status === status) : DAFTAR;
      return HttpResponse.json({
        success: true,
        data,
        pagination: {
          limit: 50,
          offset: Number(params.get("offset") ?? 0),
          total: data.length,
          has_more: false,
        },
        counts: { baru: 1, revisi: 0, revisi_lama: 0, duplikat: 1, ditolak: 1 },
      });
    }),
    http.get("/api/closing-messages/3", () =>
      HttpResponse.json({
        success: true,
        data: {
          ...DAFTAR[0],
          errors: [
            {
              type: "literal_error",
              loc: ["version"],
              msg: "Input should be 1",
            },
            {
              type: "greater_than_equal",
              loc: ["data", "items", 0, "sold"],
              msg: "Input should be greater than or equal to 0",
            },
          ],
          payload: PAYLOAD,
          body_text: null,
        },
      }),
    ),
    http.get("/api/closing-messages/9", () =>
      HttpResponse.json({
        success: true,
        data: {
          ...log(9, "ditolak", { reason: "bukan JSON", message_id: null }),
          errors: null,
          payload: null,
          body_text: "bukan json",
        },
      }),
    ),
  );
});

function permintaanTerakhir() {
  return permintaan.at(-1)!;
}

describe("ClosingMessagesView — daftar", () => {
  it("menampilkan pesan dengan status, alasan, dan peringatan", async () => {
    renderWithQuery(<ClosingMessagesView />);

    const ditolak = (await screen.findByText("pesan-3")).closest("tr")!;
    expect(within(ditolak).getByText("Ditolak")).toBeVisible();
    expect(within(ditolak).getByText("gagal validasi")).toBeVisible();

    const baru = screen.getByText("pesan-1").closest("tr")!;
    expect(within(baru).getByText("Baru")).toBeVisible();
    expect(
      within(baru).getByText("outlet belum terdaftar di api_keys"),
    ).toBeVisible();
    expect(within(baru).getByText("12")).toBeVisible();
  });

  it("tombol status menampilkan jumlahnya", async () => {
    renderWithQuery(<ClosingMessagesView />);

    expect(
      await screen.findByRole("button", { name: "Semua (3)" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Ditolak (1)" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Revisi lama (0)" }),
    ).toBeVisible();
  });

  it("memilih status mengirim filter ke server", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ClosingMessagesView />);

    await user.click(
      await screen.findByRole("button", { name: "Ditolak (1)" }),
    );

    await waitFor(() =>
      expect(permintaanTerakhir().get("status")).toBe("ditolak"),
    );
    expect(screen.getByRole("button", { name: "Ditolak (1)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await waitFor(() => expect(screen.queryByText("pesan-1")).toBeNull());
  });

  it("pencarian dan tanggal terima ikut dikirim", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ClosingMessagesView />);
    await screen.findByText("pesan-3");

    await user.type(screen.getByLabelText(/cari/i), "STTSM");
    await waitFor(() => expect(permintaanTerakhir().get("q")).toBe("STTSM"));

    await user.type(screen.getByLabelText(/diterima dari/i), "2026-10-02");
    await waitFor(() =>
      expect(permintaanTerakhir().get("start_date")).toBe("2026-10-02"),
    );
  });

  it("kosong menjelaskan bahwa consumer belum menerima pesan", async () => {
    server.use(
      http.get("/api/closing-messages", () =>
        HttpResponse.json({
          success: true,
          data: [],
          pagination: { limit: 50, offset: 0, total: 0, has_more: false },
          counts: {
            baru: 0,
            revisi: 0,
            revisi_lama: 0,
            duplikat: 0,
            ditolak: 0,
          },
        }),
      ),
    );
    renderWithQuery(<ClosingMessagesView />);

    expect(await screen.findByText(/belum ada pesan/i)).toBeVisible();
  });
});

describe("ClosingMessagesView — detail", () => {
  it("menampilkan error validasi dan JSON asli", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ClosingMessagesView />);

    const baris = (await screen.findByText("pesan-3")).closest("tr")!;
    await user.click(within(baris).getByRole("button", { name: "Detail" }));

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("version")).toBeVisible();
    expect(within(dialog).getByText("Input should be 1")).toBeVisible();
    expect(within(dialog).getByText("data.items[0].sold")).toBeVisible();
    expect(
      within(dialog).getByText(/"version": 2/, { selector: "pre" }),
    ).toBeVisible();
  });

  it("pesan bukan JSON memperlihatkan teks mentahnya", async () => {
    server.use(
      http.get("/api/closing-messages", () =>
        HttpResponse.json({
          success: true,
          data: [log(9, "ditolak", { reason: "bukan JSON", message_id: null })],
          pagination: { limit: 50, offset: 0, total: 1, has_more: false },
          counts: {
            baru: 0,
            revisi: 0,
            revisi_lama: 0,
            duplikat: 0,
            ditolak: 1,
          },
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithQuery(<ClosingMessagesView />);

    const baris = (await screen.findByText("bukan JSON")).closest("tr")!;
    await user.click(within(baris).getByRole("button", { name: "Detail" }));

    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText("bukan json", { selector: "pre" }),
    ).toBeVisible();
  });
});
