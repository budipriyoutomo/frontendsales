import { createApiClient } from "./client";

/**
 * Client yang dipakai dari browser.
 *
 * Base URL sengaja kosong: semua request pergi ke origin sendiri, yaitu
 * Route Handler Next, bukan langsung ke FastAPI. Tidak ada `getToken` karena
 * tokennya ada di cookie httpOnly yang ikut otomatis dan memang tidak boleh
 * terbaca JavaScript (keputusan 0.2).
 */
export const api = createApiClient({ baseUrl: "" });
