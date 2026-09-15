import { setupServer } from "msw/node";

/**
 * Server MSW kosong — tiap test mendaftarkan handler-nya sendiri lewat
 * `server.use(...)`. Sengaja tidak ada handler default supaya request yang
 * tidak diduga gagal keras (`onUnhandledRequest: "error"`), bukan diam-diam
 * lolos ke jaringan sungguhan.
 */
export const server = setupServer();
