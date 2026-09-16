import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { TopProducts } from "@/components/dashboard/top-products";
import type { Filter } from "@/lib/filter";

const FILTER: Filter = { start_date: "2026-09-01", end_date: "2026-09-12" };

let urlTerlaris = "";

beforeEach(() => {
  urlTerlaris = "";
  server.use(
    http.get("/api/sales/top-products", ({ request }) => {
      urlTerlaris = request.url;
      return HttpResponse.json({
        success: true,
        data: [
          {
            product_id: 5,
            product_name: "Es Teh Manis",
            product_group: "MINUMAN",
            total_qty: 12,
            total_amount: 96000,
          },
        ],
      });
    }),
    http.get("/api/sales/product-groups", () =>
      HttpResponse.json({ success: true, data: ["COLORPLATE", "MINUMAN"] }),
    ),
  );
});

describe("TopProducts — filter group (10.11)", () => {
  it("menyediakan pemilih grup dari daftar group yang sama (10.9)", async () => {
    renderWithQuery(<TopProducts filter={FILTER} onGroupChange={vi.fn()} />);

    expect(await screen.findByLabelText(/grup/i)).toBeInTheDocument();
  });

  it("mengirim product_group saat grup dipilih", async () => {
    renderWithQuery(
      <TopProducts filter={FILTER} group="MINUMAN" onGroupChange={vi.fn()} />,
    );

    await screen.findByText("Es Teh Manis");
    expect(new URL(urlTerlaris).searchParams.get("product_group")).toBe(
      "MINUMAN",
    );
  });

  it("tanpa grup terpilih, tidak mengirim product_group", async () => {
    renderWithQuery(<TopProducts filter={FILTER} onGroupChange={vi.fn()} />);

    await screen.findByText("Es Teh Manis");
    expect(new URL(urlTerlaris).searchParams.has("product_group")).toBe(false);
  });
});
