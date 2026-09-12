# TODO — Dashboard Frontend (Next.js)

Repo: `D:\Project\maharasa\sync-frontend` — **terpisah** dari `sync-api`.
Stack terpasang: Next.js 16.3.5 · React 19.2.8 · Tailwind v4 · TypeScript 5 ·
Vitest 4 · Testing Library · MSW 2 · TanStack Query 5. Dokumen ini ditulis dari kontrak API yang
sudah diverifikasi langsung ke server yang berjalan — 26 endpoint, semuanya
dites 200 dengan token dan 401 tanpa token.

Aturan yang berlaku sama seperti backend: **TDD wajib** — test merah dulu,
baru implementasi.

---

## Fase 0 — Keputusan yang harus diambil sebelum menulis kode

Empat hal ini menentukan struktur seluruh aplikasi. Menundanya berarti
menulis ulang nanti.

- [x] **0.1 Lokasi & nama repo:** `D:\Project\maharasa\sync-frontend`, git repo sendiri.

- [x] **0.2 Cara menyimpan token — DIPUTUSKAN: opsi A (BFF, httpOnly cookie).**

      Dashboard ini bisa membaca dan **membuat ulang API key semua outlet**
      (`POST /api/api-keys/{outlet}/rotate` mengembalikan key mentah). Artinya
      token admin yang dicuri = seluruh kunci POS dicuri.

      | Opsi | Konsekuensi |
      |---|---|
      | **A. BFF — token di httpOnly cookie (disarankan)** | Route Handler Next jadi proxy ke FastAPI. Token tidak pernah tersentuh JavaScript, jadi XSS tidak bisa mencurinya. Server Component bisa fetch data. CORS jadi tidak relevan (satu origin). Biaya: satu lapis proxy tipis. |
      | B. Token di `localStorage` | Paling sedikit kode, tapi XSS apa pun = token admin bocor. Semua fetch harus client-side. |
      | C. Access token di memori + refresh di cookie | Aman di tengah, tapi hilang tiap refresh halaman sampai refresh token dipakai — kedip di setiap reload. |

      Backend tetap Bearer seperti sekarang; cookie hanya antara browser dan Next.
      Konsekuensi untuk Fase 2: login diposting ke Route Handler Next, bukan
      langsung ke FastAPI.

- [ ] **0.3 UI kit.** *(Tailwind v4 sudah terpasang dari scaffold)* Usulan: Tailwind + shadcn/ui (komponen ditempel ke repo,
      bukan dependency — bebas diubah). Chart: Recharts.

- [ ] **0.4 Bahasa antarmuka.** Usulan: Indonesia, format angka `id-ID`
      (`Rp 4.418.375`), tanggal `dd MMM yyyy`.

---

## Fase 0b — PEMBLOKIR dari sisi backend

- [x] **0.5 Angka omzet salah kolom — SUDAH DIPERBAIKI.** `get_summary`,
      `get_daily_sales`, dan `get_sales_by_outlet` tadinya menjumlahkan
      `ReceiptTotalAmount`, dan kolom itu **jumlah item, bukan uang** —
      terbukti `ReceiptTotalAmount == sum(orderdetail.Amount)` di 14/14 baris.

      Diputuskan: omzet = **`ReceiptPayPrice`** (yang benar-benar dibayar).
      Diperbaiki dengan TDD — 14 test merah dulu, lalu hijau. Dikunci oleh
      `TestOmzetPakaiKolomUang`, yang mengunci **pilihan kolomnya**, bukan
      sekadar angkanya.

      Terverifikasi ke database: summary sekarang **Rp 4.418.375**
      (sebelumnya Rp 109), rata-rata Rp 315.598 per struk.
      Fase 4 tidak lagi terblokir.

- [ ] **0.6 Bentuk response tidak seragam.** `/api/auth/*` mengembalikan objek
      polos (`{access_token, refresh_token, user, ...}`), semua endpoint lain
      dibungkus `{success, data}`. API client harus menangani dua bentuk.
      Kalau mau diseragamkan di backend, **sekarang momen termurahnya** —
      setelah frontend jadi, biayanya dua sisi.

---

## Fase 1 — Fondasi proyek

- [x] 1.1 `create-next-app` — App Router, TypeScript, Tailwind, ESLint.
- [ ] 1.2 Prettier + ESLint disepakati, jalan di pre-commit.
- [ ] 1.3 Struktur folder: `app/`, `components/`, `lib/`, `hooks/`, `types/`.
- [ ] 1.4 `.env.local` → `API_BASE_URL=http://localhost:8000`. *(BFF: tidak perlu `NEXT_PUBLIC_`)*
      Catatan: `CORS_ORIGINS` backend sudah `http://localhost:3000` (port
      default Next), jadi tidak perlu diubah.
- [x] 1.5 **Generate tipe dari `/openapi.json`** (`openapi-typescript`).
      Jangan mengetik ulang tipe response — backend sudah ter-skema penuh,
      dan tipe yang diketik tangan akan berbeda diam-diam saat backend berubah.
      Hasil: `src/types/api.ts` (2.188 baris, 26 path). Regenerasi dengan
      `npm run gen:api` saat backend berubah; `openapi.json` disalin ke repo ini
      supaya generate tidak menuntut backend hidup.
- [ ] 1.6 Client HTTP terpusat: base URL, header auth, penanganan error seragam.
- [ ] 1.7 TanStack Query untuk cache + state server. *(paket terpasang, belum diwire)*

### Test Fase 1
- [x] 1.8 Vitest + Testing Library + jsdom jalan (`npm test`, config di `vitest.config.mts`).
- [ ] 1.9 MSW (Mock Service Worker) untuk memalsukan API di test. *(paket terpasang, belum dikonfigurasi)*
- [ ] 1.10 Test: client HTTP menempelkan header `Authorization`.
- [ ] 1.11 Test: client membongkar `{success, data}` **dan** objek polos (lihat 0.6).

---

## Fase 2 — Autentikasi

Fakta dari backend:

- Access token **30 menit**, refresh token **7 hari**.
- `POST /api/auth/login` dibatasi **10 percobaan / 5 menit per alamat**;
  melewati batas → `429` + header `Retry-After`.
- `POST /api/auth/refresh` mengembalikan access token baru **dari data user
  terkini** — jadi perubahan role langsung berlaku tanpa login ulang.
- Logout hanya penanda; token dibuang di sisi klien.

- [ ] 2.1 Halaman `/login`.
- [ ] 2.2 Simpan token sesuai keputusan 0.2.
- [ ] 2.3 Middleware Next: redirect ke `/login` kalau belum masuk.
- [ ] 2.4 Auto-refresh saat access token mau habis.
- [ ] 2.5 Interceptor global: `401` → coba refresh sekali; gagal → logout.
- [ ] 2.6 Tangani `429` — tampilkan sisa detik dari `Retry-After`,
      jangan sekadar "login gagal" (user akan mengira passwordnya salah).
- [ ] 2.7 Halaman ganti password (`POST /api/auth/change-password`,
      wajib mengirim `current_password`).
- [ ] 2.8 Paksa ganti password saat pertama masuk — admin pertama dibuat
      dengan password sementara.

### Test Fase 2
- [ ] 2.9 Login sukses menyimpan token dan pindah halaman.
- [ ] 2.10 Kredensial salah menampilkan pesan, tidak membuka dashboard.
- [ ] 2.11 `429` menampilkan pesan tunggu, bukan pesan kredensial salah.
- [ ] 2.12 `401` di tengah sesi memicu refresh, lalu mengulang request.
- [ ] 2.13 Refresh yang gagal melempar ke `/login`.
- [ ] 2.14 Halaman terlindungi tidak bisa dibuka tanpa token.

---

## Fase 3 — Layout & hak akses

Tiga role: `admin`, `manager`, `outlet`.

| Endpoint | admin | manager | outlet |
|---|:--:|:--:|:--:|
| `/api/sales/*` (summary, daily, top-products, list, detail, export) | ya | ya | ya, **otomatis terkunci ke outletnya** |
| `/api/sales/by-outlet` | ya | ya | — |
| `/api/outlets` | ya | ya | — |
| `/api/outlets/sync-status` | ya | ya | ya |
| `/api/api-keys/*` | ya | — | — |
| `/api/users/*` | ya | — | — |

Penting: untuk role `outlet`, parameter `?outlet=` **diabaikan server**.
Scope diambil dari identitas, bukan dari query. Jadi filter outlet di UI
harus disembunyikan untuk role itu — bukan demi keamanan (server sudah
menjaga), tapi supaya tidak membingungkan.

- [ ] 3.1 Shell: sidebar + topbar + area konten.
- [ ] 3.2 Menu menyesuaikan role.
- [ ] 3.3 Komponen `<RequireRole>` untuk halaman.
- [ ] 3.4 Halaman 403 yang jelas, bukan layar kosong.
- [ ] 3.5 Menu user: nama, role, outlet, ganti password, logout.
- [ ] 3.6 Responsif — sidebar jadi drawer di layar kecil.

### Test Fase 3
- [ ] 3.7 Manager tidak melihat menu API key & user.
- [ ] 3.8 Role outlet tidak melihat pemilih outlet.
- [ ] 3.9 Membuka `/users` sebagai manager → 403, bukan crash.

---

## Fase 4 — Dashboard  ⚠️ tunggu 0.5 beres

- [ ] 4.1 Filter global: rentang tanggal + outlet (outlet hanya admin/manager).
- [ ] 4.2 Kartu ringkasan — `GET /api/sales/summary`
      → `{total_transactions, total_amount, total_discount, average_per_transaction}`
- [ ] 4.3 Grafik omzet harian — `GET /api/sales/daily`
      → `[{sale_date, total_transactions, total_amount}]`
- [ ] 4.4 Perbandingan antar outlet — `GET /api/sales/by-outlet` (admin/manager)
- [ ] 4.5 Produk terlaris — `GET /api/sales/top-products`
      params: `outlet`, `start_date`, `end_date`, `product_group`,
      `limit` (default 10, maks 100)
      → `[{product_id, product_name, product_group, total_qty, total_amount}]`
- [ ] 4.6 Keadaan kosong yang masuk akal (outlet baru, belum ada transaksi).
- [ ] 4.7 Skeleton saat memuat, bukan layar kosong yang berkedip.
- [ ] 4.8 Filter tersimpan di URL — supaya bisa dibagikan & tombol back jalan.

### Test Fase 4
- [ ] 4.9 Kartu menampilkan angka dari API, terformat `id-ID`.
- [ ] 4.10 Ganti rentang tanggal memicu request ulang dengan param benar.
- [ ] 4.11 Data kosong → pesan, bukan `NaN` atau `Rp 0` yang menyesatkan.
- [ ] 4.12 Error API → pesan + tombol coba lagi.

---

## Fase 5 — Transaksi

- [ ] 5.1 Tabel — `GET /api/sales/`
      params: `outlet`, `start_date`, `end_date`, `limit` (default 50, **maks 500**), `offset`
      → `{success, data:[...], pagination:{limit, offset, total, has_more}}`
- [ ] 5.2 Pagination pakai `has_more` + `total` dari response.
- [ ] 5.3 Detail — `GET /api/sales/{transaction_id}` (beserta item).
- [ ] 5.4 Export CSV — `GET /api/sales/export` mengembalikan **stream CSV**,
      bukan JSON. Perlu ditangani sebagai blob download, dan nama file diambil
      dari header `Content-Disposition`.
- [ ] 5.5 Tandai transaksi `Deleted=1` (void) secara visual.
      Catatan: `/api/sales/` **masih menyertakan** transaksi void, sedangkan
      endpoint laporan mengecualikannya — inkonsistensi yang backend sengaja
      tunda (item 4.5 di `TODO.md`). Sampai diputuskan, angka di tabel dan di
      kartu ringkasan bisa berbeda.

### Test Fase 5
- [ ] 5.6 Tabel merender baris dari API.
- [ ] 5.7 Klik halaman berikutnya mengirim `offset` yang benar.
- [ ] 5.8 `has_more: false` menonaktifkan tombol berikutnya.
- [ ] 5.9 Export memicu unduhan, bukan menampilkan CSV mentah di layar.

---

## Fase 6 — Administrasi (khusus admin)

### API key outlet
- [ ] 6.1 Daftar — `GET /api/api-keys` (hanya `key_prefix`, tidak pernah key mentah).
- [ ] 6.2 Buat — `POST /api/api-keys` `{outlet_code}`.
      Outlet yang sudah punya key ditolak **409** — tampilkan sebagai
      "outlet ini sudah punya key, gunakan Rotate", bukan "terjadi kesalahan".
- [ ] 6.3 Rotate — `POST /api/api-keys/{outlet_code}/rotate`.
- [ ] 6.4 Revoke — `POST /api/api-keys/{outlet_code}/revoke`.
- [ ] 6.5 **Dialog key sekali-lihat.** `create` dan `rotate` adalah satu-satunya
      response yang memuat `api_key` mentah. Harus ada tombol salin dan
      peringatan jelas; kalau dialog ditutup, key itu hilang selamanya.
- [ ] 6.6 Konfirmasi ketik-nama-outlet sebelum rotate/revoke — keduanya
      **langsung mematikan mesin POS di lapangan**.

### User
- [ ] 6.7 Daftar — `GET /api/users`
- [ ] 6.8 Buat — `POST /api/users` `{email, password, role, outlet_code?, full_name?}`
      (password minimal 8 karakter; role `outlet` **wajib** `outlet_code` → 422)
- [ ] 6.9 Ubah — `PATCH /api/users/{id}` `{full_name?, role?, outlet_code?, is_active?}`
- [ ] 6.10 Reset password — `POST /api/users/{id}/password`
- [ ] 6.11 Tampilkan pagar backend sebagai UI, jangan biarkan jadi error 400:
      - akun sendiri tidak bisa dinonaktifkan / diturunkan → matikan tombolnya
      - admin aktif terakhir tidak bisa diturunkan / dinonaktifkan
      - `email` tidak bisa diubah → field dikunci saat edit

### Test Fase 6
- [ ] 6.12 Key mentah tampil sekali dan bisa disalin.
- [ ] 6.13 409 saat buat key duplikat → pesan mengarahkan ke Rotate.
- [ ] 6.14 Rotate butuh konfirmasi ketik nama outlet.
- [ ] 6.15 Tombol nonaktifkan mati untuk akun sendiri.
- [ ] 6.16 Membuat user role `outlet` tanpa outlet → pesan validasi di field.

---

## Fase 7 — Status sync per outlet

- [ ] 7.1 `GET /api/outlets/sync-status` — kapan tiap outlet terakhir mengirim data.
- [ ] 7.2 Tandai outlet yang sudah lama tidak sync (POS mati / jaringan putus).
      Ini halaman paling berguna secara operasional — outlet yang diam berarti
      omzetnya hilang dari laporan, dan tidak ada yang memberi tahu.
- [ ] 7.3 Auto-refresh berkala.

### Test Fase 7
- [ ] 7.4 Outlet yang basi tampil dengan penanda.
- [ ] 7.5 Outlet yang belum pernah sync tidak merender tanggal kosong.

---

## Fase 8 — Kualitas

- [ ] 8.1 Playwright E2E: login → dashboard → transaksi → logout.
- [ ] 8.2 E2E: alur buat & rotate API key.
- [ ] 8.3 E2E per role (admin, manager, outlet).
- [ ] 8.4 GitHub Actions: lint + unit test + build + Playwright.
- [ ] 8.5 Ambang cakupan test untuk `lib/` dan `hooks/`.
- [ ] 8.6 Error boundary + halaman 500.
- [ ] 8.7 Cek aksesibilitas dasar (fokus keyboard, label form, kontras).

---

## Fase 9 — Deploy

- [ ] 9.1 Dockerfile (multi-stage, `output: "standalone"`).
- [ ] 9.2 `API_BASE_URL` per environment.
- [ ] 9.3 Tambahkan origin produksi ke `CORS_ORIGINS` backend
      (tidak perlu kalau memilih opsi BFF di 0.2).
- [ ] 9.4 Jangan bocorkan secret ke bundel klien — hanya `NEXT_PUBLIC_*`
      yang boleh sampai ke browser.

---

## Lampiran — Kontrak API terverifikasi

Base URL: `http://localhost:8000` · Auth: `Authorization: Bearer <access_token>`
OpenAPI: `/openapi.json` · Swagger: `/docs`

```
POST   /api/auth/login              {email, password} -> {access_token, refresh_token,
                                     token_type, expires_in, user{id,email,full_name,
                                     role,outlet_code,is_active}}         [publik, 429]
POST   /api/auth/refresh            {refresh_token} -> {access_token, token_type, expires_in}
GET    /api/auth/me                 -> user (objek polos)
POST   /api/auth/logout             -> {success, message}
POST   /api/auth/change-password    {current_password, new_password}

GET    /api/sales/                  ?outlet&start_date&end_date&limit&offset
GET    /api/sales/summary           ?outlet&start_date&end_date
GET    /api/sales/daily             ?outlet&start_date&end_date
GET    /api/sales/by-outlet         ?start_date&end_date          [admin, manager]
GET    /api/sales/top-products      ?outlet&start_date&end_date&product_group&limit
GET    /api/sales/export            ?outlet&start_date&end_date   -> CSV stream
GET    /api/sales/colorplate        ?outlet&start_date&end_date
GET    /api/sales/{transaction_id}

GET    /api/outlets                                               [admin, manager]
GET    /api/outlets/sync-status

GET    /api/api-keys                                              [admin]
POST   /api/api-keys                {outlet_code}                 [admin] 201 / 409
POST   /api/api-keys/{outlet}/rotate                              [admin] -> api_key mentah
POST   /api/api-keys/{outlet}/revoke                              [admin]

GET    /api/users                                                 [admin]
POST   /api/users                   {email,password,role,outlet_code?,full_name?} [admin] 201
GET    /api/users/{id}                                            [admin]
PATCH  /api/users/{id}              {full_name?,role?,outlet_code?,is_active?}    [admin]
POST   /api/users/{id}/password     {password}                    [admin]

GET    /health        /health/ready
```

Tidak dipakai frontend (jalur mesin POS, autentikasi pakai API key bukan JWT):
`POST /api/sync/sales`, `POST /api/sales/publish`.
