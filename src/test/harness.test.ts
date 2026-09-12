import { describe, expect, it } from "vitest";

describe("harness test", () => {
  it("menjalankan test dan mengenali matcher jest-dom", () => {
    const el = document.createElement("div");
    el.textContent = "halo";
    document.body.appendChild(el);

    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent("halo");
  });
});
