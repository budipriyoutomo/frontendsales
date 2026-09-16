import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { GroupRecap } from "@/components/dashboard/group-recap";
import type { Filter } from "@/lib/filter";

const FILTER: Filter = {
  start_date: "2026-09-01",
  end_date: "2026-09-12",
  outlet: "OUT1",
};

let urlGroup = "";

beforeEach(() => {
  urlGroup = "";
  server.use(
    http.get("/api/sales/product-groups", ({ request }) => {
      urlGroup = request.url;
      return HttpResponse.json({
        success: true,
        data: ["COLORPLATE", "MINUMAN"],
      });
    }),
  );
});

describe("GroupRecap — pilihan group (10.9)", () => {
  it("mengambil daftar group dari data penjualan, ikut filter outlet", async () => {
    renderWithQuery(
      <GroupRecap filter={FILTER} terpilih={[]} onTerpilihChange={vi.fn()} />,
    );

    const pilihan = await screen.findByRole("group", { name: /pilih group/i });
    expect(
      within(pilihan).getByRole("button", { name: "COLORPLATE" }),
    ).toBeInTheDocument();
    expect(new URL(urlGroup).searchParams.get("outlet")).toBe("OUT1");
  });

  it("belum ada group terpilih → ajakan memilih, tanpa request rekap", async () => {
    let rekapDiminta = 0;
    server.use(
      http.get("/api/sales/by-group", () => {
        rekapDiminta += 1;
        return HttpResponse.json({ success: true, data: [] });
      }),
    );

    renderWithQuery(
      <GroupRecap filter={FILTER} terpilih={[]} onTerpilihChange={vi.fn()} />,
    );

    // Backend mewajibkan `product_group` — request tanpa group pasti 422.
    expect(
      await screen.findByText(/pilih satu atau lebih group/i),
    ).toBeVisible();
    expect(rekapDiminta).toBe(0);
  });

  it("klik group menambah atau melepasnya dari pilihan", async () => {
    const ubah = vi.fn();
    server.use(
      http.get("/api/sales/by-group", () =>
        HttpResponse.json({ success: true, data: [] }),
      ),
    );

    renderWithQuery(
      <GroupRecap
        filter={FILTER}
        terpilih={["COLORPLATE"]}
        onTerpilihChange={ubah}
      />,
    );
    const user = userEvent.setup();

    const colorplate = await screen.findByRole("button", {
      name: "COLORPLATE",
    });
    expect(colorplate).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "MINUMAN" }));
    expect(ubah).toHaveBeenLastCalledWith(["COLORPLATE", "MINUMAN"]);

    await user.click(colorplate);
    expect(ubah).toHaveBeenLastCalledWith([]);
  });

  it("daftar group gagal dimuat, pilihan dari URL tetap bisa dilepas", async () => {
    server.use(
      http.get("/api/sales/product-groups", () =>
        HttpResponse.json({ detail: "Terjadi kesalahan" }, { status: 500 }),
      ),
      http.get("/api/sales/by-group", () =>
        HttpResponse.json({ success: true, data: [] }),
      ),
    );
    const ubah = vi.fn();

    renderWithQuery(
      <GroupRecap
        filter={FILTER}
        terpilih={["COLORPLATE"]}
        onTerpilihChange={ubah}
      />,
    );
    const user = userEvent.setup();

    // Kalau chip ikut hilang bersama daftarnya, group dari URL tersangkut:
    // rekap tetap memakainya tapi tidak ada cara melepasnya.
    const chip = await screen.findByRole("button", { name: "COLORPLATE" });
    expect(chip).toHaveAttribute("aria-pressed", "true");

    await user.click(chip);
    expect(ubah).toHaveBeenLastCalledWith([]);
  });

  it("group terpilih dari URL yang tidak ada di data tetap bisa dilepas", async () => {
    server.use(
      http.get("/api/sales/by-group", () =>
        HttpResponse.json({ success: true, data: [] }),
      ),
    );

    renderWithQuery(
      <GroupRecap
        filter={FILTER}
        terpilih={["GROUP LAMA"]}
        onTerpilihChange={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("button", { name: "GROUP LAMA" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

describe("GroupRecap — rekap (10.10, 10.17, 10.18)", () => {
  it("mengirim beberapa group sebagai param berulang (10.17)", async () => {
    let url = "";
    server.use(
      http.get("/api/sales/by-group", ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          success: true,
          data: [
            {
              product_group: "COLORPLATE",
              product_name: "Piring Merah",
              outlet_code: "OUT1",
              sale_date: "2026-09-12",
              sold: 1.5,
            },
          ],
        });
      }),
    );

    renderWithQuery(
      <GroupRecap
        filter={FILTER}
        terpilih={["COLORPLATE", "MINUMAN"]}
        onTerpilihChange={vi.fn()}
      />,
    );

    const produk = await screen.findByText("Piring Merah");
    const q = new URL(url).searchParams;
    expect(q.getAll("product_group")).toEqual(["COLORPLATE", "MINUMAN"]);
    expect(q.get("start_date")).toBe("2026-09-01");
    expect(q.get("end_date")).toBe("2026-09-12");
    expect(q.get("outlet")).toBe("OUT1");

    // `sold` bisa desimal — terformat id-ID, bukan dibulatkan.
    expect(within(produk.closest("tr")!).getByText("1,5")).toBeInTheDocument();
  });

  it("rekap kosong → pesan, bukan tabel kosong (10.18)", async () => {
    server.use(
      http.get("/api/sales/by-group", () =>
        HttpResponse.json({ success: true, data: [] }),
      ),
    );

    renderWithQuery(
      <GroupRecap
        filter={FILTER}
        terpilih={["MINUMAN"]}
        onTerpilihChange={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(/tidak ada penjualan untuk group terpilih/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("error rekap → pesan dan coba lagi (pola 4.12)", async () => {
    server.use(
      http.get("/api/sales/by-group", () =>
        HttpResponse.json({ detail: "Terjadi kesalahan" }, { status: 500 }),
      ),
    );

    renderWithQuery(
      <GroupRecap
        filter={FILTER}
        terpilih={["MINUMAN"]}
        onTerpilihChange={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/terjadi kesalahan/i),
    );
    expect(screen.getByRole("button", { name: /coba lagi/i })).toBeVisible();
  });
});
