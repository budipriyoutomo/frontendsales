import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { FilterBar } from "@/components/dashboard/filter-bar";

const replace = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => searchParams,
}));

beforeEach(() => {
  replace.mockClear();
  searchParams = new URLSearchParams(
    "start_date=2026-03-01&end_date=2026-03-31",
  );
  server.use(
    http.get("/api/outlets", () =>
      HttpResponse.json({
        success: true,
        data: [
          { outlet_code: "OUT1", is_active: true },
          { outlet_code: "OUT2", is_active: true },
        ],
      }),
    ),
  );
});

describe("FilterBar — rentang tanggal (4.1, 4.8, 4.10)", () => {
  it("menulis rentang baru ke URL supaya bisa dibagikan", async () => {
    renderWithQuery(<FilterBar role="admin" />);

    // Input tanggal dikendalikan URL, jadi nilainya diganti sekali jalan —
    // mengetik per karakter akan memancarkan tanggal setengah jadi.
    fireEvent.change(screen.getByLabelText(/dari tanggal/i), {
      target: { value: "2026-03-15" },
    });

    await waitFor(() => expect(replace).toHaveBeenCalled());
    const terakhir = replace.mock.calls.at(-1)![0] as string;
    expect(terakhir).toContain("start_date=2026-03-15");
    expect(terakhir).toContain("end_date=2026-03-31");
  });

  it("mengganti tanggal tidak mengosongkan group terpilih (10.12)", async () => {
    searchParams = new URLSearchParams(
      "start_date=2026-03-01&end_date=2026-03-31&product_group=A&product_group=B",
    );
    renderWithQuery(<FilterBar role="admin" />);

    fireEvent.change(screen.getByLabelText(/sampai tanggal/i), {
      target: { value: "2026-03-20" },
    });

    await waitFor(() => expect(replace).toHaveBeenCalled());
    const terakhir = replace.mock.calls.at(-1)![0] as string;
    const params = new URLSearchParams(terakhir.split("?")[1]);
    expect(params.get("end_date")).toBe("2026-03-20");
    expect(params.getAll("product_group")).toEqual(["A", "B"]);
  });

  it("mengganti tanggal mengembalikan paginasi ke halaman pertama", async () => {
    // FilterBar juga dipakai di halaman transaksi, yang menyimpan `offset`
    // di URL. Filter baru dengan offset lama = halaman kosong yang
    // menyesatkan.
    searchParams = new URLSearchParams(
      "start_date=2026-03-01&end_date=2026-03-31&offset=100&product_group=A",
    );
    renderWithQuery(<FilterBar role="admin" />);

    fireEvent.change(screen.getByLabelText(/dari tanggal/i), {
      target: { value: "2026-03-05" },
    });

    await waitFor(() => expect(replace).toHaveBeenCalled());
    const params = new URLSearchParams(
      (replace.mock.calls.at(-1)![0] as string).split("?")[1],
    );
    expect(params.has("offset")).toBe(false);
    // Yang bukan urusan paginasi tetap dibawa.
    expect(params.getAll("product_group")).toEqual(["A"]);
  });

  it("menampilkan nilai filter dari URL, bukan dari state sendiri", () => {
    renderWithQuery(<FilterBar role="admin" />);

    expect(screen.getByLabelText(/dari tanggal/i)).toHaveValue("2026-03-01");
    expect(screen.getByLabelText(/sampai tanggal/i)).toHaveValue("2026-03-31");
  });

  it("preset 7 hari menulis rentang tujuh hari ke URL", async () => {
    renderWithQuery(<FilterBar role="admin" />);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "7 hari" }));

    const terakhir = replace.mock.calls.at(-1)![0] as string;
    const params = new URLSearchParams(terakhir.split("?")[1]);
    const mulai = new Date(params.get("start_date")!);
    const akhir = new Date(params.get("end_date")!);
    const selisihHari =
      (akhir.getTime() - mulai.getTime()) / (1000 * 60 * 60 * 24);

    expect(selisihHari).toBe(6); // 7 hari termasuk hari ini
  });
});

describe("FilterBar — pemilih outlet per role (3.8)", () => {
  it("menampilkan pemilih outlet untuk admin", async () => {
    renderWithQuery(<FilterBar role="admin" />);

    expect(await screen.findByLabelText(/outlet/i)).toBeInTheDocument();
  });

  it("menampilkan pemilih outlet untuk manager", async () => {
    renderWithQuery(<FilterBar role="manager" />);

    expect(await screen.findByLabelText(/outlet/i)).toBeInTheDocument();
  });

  it("menyembunyikan pemilih outlet untuk role outlet", () => {
    renderWithQuery(<FilterBar role="outlet" />);

    // Server mengabaikan `?outlet=` untuk role ini; filter yang tidak
    // berefek hanya membingungkan.
    expect(screen.queryByLabelText(/outlet/i)).not.toBeInTheDocument();
  });

  it("tidak meminta daftar outlet sama sekali untuk role outlet", async () => {
    let diminta = 0;
    server.use(
      http.get("/api/outlets", () => {
        diminta += 1;
        return HttpResponse.json({ success: true, data: [] });
      }),
    );

    renderWithQuery(<FilterBar role="outlet" />);
    await screen.findByLabelText(/dari tanggal/i);

    expect(diminta).toBe(0);
  });
});
