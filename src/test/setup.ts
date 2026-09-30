import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

/**
 * jsdom tidak punya Pointer Capture API maupun `scrollIntoView`, sedangkan
 * Radix (Select, Dropdown) memanggilnya saat menu dibuka — tanpa ini, klik
 * pada dropdown melempar `target.hasPointerCapture is not a function` dan
 * test jadi merah karena lingkungannya, bukan karena kodenya.
 */
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
// Radix Switch mengukur ukurannya lewat ResizeObserver saat dipasang.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
