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

- [x] **0.3 UI kit — DIPUTUSKAN: Tailwind + shadcn/ui.** Komponen ditempel ke
      repo (`src/components/ui/`), bukan dependency — bebas diubah. Preset
      `radix-nova`, base color neutral, ikon lucide. Chart: Recharts lewat
      `components/ui/chart.tsx`.

      Komponen `form` shadcn sengaja **tidak** dipasang: dia menyeret
          `react-hook-form` + `zod`, sedangkan form di aplikasi ini kecil-kecil
          dan sudah cukup dengan state terkendali biasa.

- [x] **0.4 Bahasa antarmuka — DIPUTUSKAN: Indonesia, `id-ID`.**
      `<html lang="id">`, angka `Rp 4.418.375`, tanggal `12 Sep 2026`.
      Semuanya lewat `src/lib/format.ts` — satu tempat, bukan sepuluh
      `toLocaleString` yang perlahan berbeda.

      Nilai yang tidak ada dirender `—`, **bukan** `Rp 0`: "Rp 0" terbaca
          seolah omzetnya memang nol padahal datanya tidak ada (lihat 4.11).

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

- [x] **0.6 Bentuk response tidak seragam.** `/api/auth/*` mengembalikan objek
      polos (`{access_token, refresh_token, user, ...}`), semua endpoint lain
      dibungkus `{success, data}`.

      **DIPUTUSKAN: backend tidak diubah, client yang menangani dua bentuk.**
          Alasan: endpoint auth sudah berjalan dan mengubahnya menyentuh kontrak
          yang dipakai di luar dashboard. Amplop dikenali hanya kalau `success`
          **dan** `data` dua-duanya ada — jadi objek polos seperti `{data: 42}`
          lolos apa adanya. Dikunci oleh test di `src/lib/api/client.test.ts`.

---

## Fase 1 — Fondasi proyek

- [x] 1.1 `create-next-app` — App Router, TypeScript, Tailwind, ESLint.
- [x] 1.2 Prettier + ESLint disepakati, jalan di pre-commit.
- [x] 1.3 Struktur folder: `app/`, `components/`, `lib/`, `hooks/`, `types/`.
- [x] 1.4 `.env.local` → `API_BASE_URL=http://localhost:8000`. _(BFF: tidak perlu `NEXT_PUBLIC_`)_
      Catatan: `CORS_ORIGINS` backend sudah `http://localhost:3000` (port
      default Next), jadi tidak perlu diubah.
- [x] 1.5 **Generate tipe dari `/openapi.json`** (`openapi-typescript`).
      Jangan mengetik ulang tipe response — backend sudah ter-skema penuh,
      dan tipe yang diketik tangan akan berbeda diam-diam saat backend berubah.
      Hasil: `src/types/api.ts` (2.188 baris, 26 path). Regenerasi dengan
      `npm run gen:api` saat backend berubah; `openapi.json` disalin ke repo ini
      supaya generate tidak menuntut backend hidup.
- [x] 1.6 Client HTTP terpusat: base URL, header auth, penanganan error seragam.
- [x] 1.7 TanStack Query untuk cache + state server. _(paket terpasang, belum diwire)_

### Test Fase 1

- [x] 1.8 Vitest + Testing Library + jsdom jalan (`npm test`, config di `vitest.config.mts`).
- [x] 1.9 MSW (Mock Service Worker) untuk memalsukan API di test. _(paket terpasang, belum dikonfigurasi)_
- [x] 1.10 Test: client HTTP menempelkan header `Authorization`.
- [x] 1.11 Test: client membongkar `{success, data}` **dan** objek polos (lihat 0.6).

---

## Fase 2 — Autentikasi

Fakta dari backend:

- Access token **30 menit**, refresh token **7 hari**.
- `POST /api/auth/login` dibatasi **10 percobaan / 5 menit per alamat**;
  melewati batas → `429` + header `Retry-After`.
- `POST /api/auth/refresh` mengembalikan access token baru **dari data user
  terkini** — jadi perubahan role langsung berlaku tanpa login ulang.
- Logout hanya penanda; token dibuang di sisi klien.

- [x] 2.1 Halaman `/login`.
- [x] 2.2 Simpan token sesuai keputusan 0.2.
- [x] 2.3 Middleware Next: redirect ke `/login` kalau belum masuk.
- [x] 2.4 Auto-refresh saat access token mau habis.
      Dikerjakan **reaktif, bukan berdasarkan timer**: proxy BFF menembak
      ulang sekali setelah kena `401` (`src/lib/api/bff.ts`), dan halaman
      server yang menemukan token mati dilempar ke `/api/auth/renew` —
      Server Component tidak boleh memasang cookie, Route Handler boleh.
      Hasilnya sama tanpa perlu menebak-nebak sisa umur token di klien.
- [x] 2.5 Interceptor global: `401` → coba refresh sekali; gagal → logout.
- [x] 2.6 Tangani `429` — tampilkan sisa detik dari `Retry-After`,
      jangan sekadar "login gagal" (user akan mengira passwordnya salah).
- [x] 2.7 Halaman ganti password (`POST /api/auth/change-password`,
      wajib mengirim `current_password`).
- [x] 2.8 Paksa ganti password saat pertama masuk — admin pertama dibuat
      dengan password sementara.

      Backend (`sync-api`) menambahkan kolom `must_change_password`, migrasi
          `005_must_change_password.sql`. Siklus hidupnya:
          `create_user` → TRUE, `set_password` (reset admin) → TRUE,
          `ganti_password_sendiri` → FALSE. Dikunci 7 test.

          DEFAULT FALSE, bukan TRUE — disengaja: baris yang sudah ada dibuat
          sebelum kolom ini lahir, dan memberi TRUE pada mereka akan memaksa
          setiap user yang sedang berjalan ganti password di login berikutnya.

          Frontend: layout `(app)` melempar ke `/ganti-password` sebelum halaman
          apa pun terbuka.

          **Catatan struktur — jangan dibatalkan.** `/ganti-password` berada di
          route group `(ganti-password)`, DI LUAR `(app)`. Pengecualian berbasis
          pathname sempat dicoba dan gagal: pathname hanya tersedia lewat header
          titipan `proxy.ts`, dan header itu **tidak sampai pada request RSC**,
          jadi penjaga memantulkan halaman ganti-password ke dirinya sendiri tanpa
          henti. Dijaga oleh test yang memeriksa letak berkasnya.

### Test Fase 2

- [x] 2.9 Login sukses menyimpan token dan pindah halaman.
- [x] 2.10 Kredensial salah menampilkan pesan, tidak membuka dashboard.
- [x] 2.11 `429` menampilkan pesan tunggu, bukan pesan kredensial salah.
- [x] 2.12 `401` di tengah sesi memicu refresh, lalu mengulang request.
- [x] 2.13 Refresh yang gagal melempar ke `/login`.
- [x] 2.14 Halaman terlindungi tidak bisa dibuka tanpa token.

---

## Fase 3 — Layout & hak akses

Tiga role: `admin`, `manager`, `outlet`.

| Endpoint                                                            | admin | manager |                 outlet                 |
| ------------------------------------------------------------------- | :---: | :-----: | :------------------------------------: |
| `/api/sales/*` (summary, daily, top-products, list, detail, export) |  ya   |   ya    | ya, **otomatis terkunci ke outletnya** |
| `/api/sales/by-outlet`                                              |  ya   |   ya    |                   —                    |
| `/api/outlets`                                                      |  ya   |   ya    |                   —                    |
| `/api/outlets/sync-status`                                          |  ya   |   ya    |                   ya                   |
| `/api/api-keys/*`                                                   |  ya   |    —    |                   —                    |
| `/api/users/*`                                                      |  ya   |    —    |                   —                    |

Penting: untuk role `outlet`, parameter `?outlet=` **diabaikan server**.
Scope diambil dari identitas, bukan dari query. Jadi filter outlet di UI
harus disembunyikan untuk role itu — bukan demi keamanan (server sudah
menjaga), tapi supaya tidak membingungkan.

- [x] 3.1 Shell: sidebar + topbar + area konten.
- [x] 3.2 Menu menyesuaikan role.
- [x] 3.3 Komponen `<RequireRole>` untuk halaman.
- [x] 3.4 Halaman 403 yang jelas, bukan layar kosong.
- [x] 3.5 Menu user: nama, role, outlet, ganti password, logout.
- [x] 3.6 Responsif — sidebar jadi drawer di layar kecil.

### Test Fase 3

- [x] 3.7 Manager tidak melihat menu API key & user.
- [x] 3.8 Role outlet tidak melihat pemilih outlet.
- [x] 3.9 Membuka `/pengguna` sebagai manager → 403, bukan crash.
      Dikunci oleh `src/components/auth/require-role.test.tsx` — termasuk
      bahwa isi halamannya **tidak ikut terkirim**, bukan sekadar
      disembunyikan CSS.

---

## Fase 4 — Dashboard ⚠️ tunggu 0.5 beres

- [x] 4.1 Filter global: rentang tanggal + outlet (outlet hanya admin/manager).
- [x] 4.2 Kartu ringkasan — `GET /api/sales/summary`
      → `{total_transactions, total_amount, total_discount, average_per_transaction}`
- [x] 4.3 Grafik omzet harian — `GET /api/sales/daily`
      → `[{sale_date, total_transactions, total_amount}]`
- [x] 4.4 Perbandingan antar outlet — `GET /api/sales/by-outlet` (admin/manager)
- [x] 4.5 Produk terlaris — `GET /api/sales/top-products`
      params: `outlet`, `start_date`, `end_date`, `product_group`,
      `limit` (default 10, maks 100)
      → `[{product_id, product_name, product_group, total_qty, total_amount}]`
- [x] 4.6 Keadaan kosong yang masuk akal (outlet baru, belum ada transaksi).
- [x] 4.7 Skeleton saat memuat, bukan layar kosong yang berkedip.
- [x] 4.8 Filter tersimpan di URL — supaya bisa dibagikan & tombol back jalan.

### Test Fase 4

- [x] 4.9 Kartu menampilkan angka dari API, terformat `id-ID`.
- [x] 4.10 Ganti rentang tanggal memicu request ulang dengan param benar.
- [x] 4.11 Data kosong → pesan, bukan `NaN` atau `Rp 0` yang menyesatkan.
- [x] 4.12 Error API → pesan + tombol coba lagi.

---

## Fase 5 — Transaksi

- [x] 5.1 Tabel — `GET /api/sales/`
      params: `outlet`, `start_date`, `end_date`, `limit` (default 50, **maks 500**), `offset`
      → `{success, data:[...], pagination:{limit, offset, total, has_more}}`
- [x] 5.2 Pagination pakai `has_more` + `total` dari response.
- [x] 5.3 Detail — `GET /api/sales/{transaction_id}` (beserta item).
- [x] 5.4 Export CSV — `GET /api/sales/export` mengembalikan **stream CSV**,
      bukan JSON. Perlu ditangani sebagai blob download, dan nama file diambil
      dari header `Content-Disposition`.
- [x] 5.5 Tandai transaksi `Deleted=1` (void) secara visual.

      Backend (`sync-api`) kini mengekspos `deleted` di `SaleResponse` —
          aditif, tanpa migrasi karena kolomnya sudah ada. Dikunci 5 test.

          Frontend memakai kolom itu, bukan lagi menebak lewat `void_staff_id`.
          Penting karena `Deleted` adalah kolom yang **sama** yang dipakai
          endpoint laporan untuk mengecualikan baris: penanda yang berbeda
          membuat tabel dan kartu ringkasan bercerita beda soal struk yang sama.

          Catatan lama yang masih berlaku: `/api/sales/` **masih menyertakan**
          transaksi void, sedangkan endpoint laporan mengecualikannya —
          inkonsistensi yang backend sengaja tunda (item 4.5 di `TODO.md`
          sync-api). Sampai diputuskan, angka di tabel dan di kartu ringkasan
          bisa berbeda.

### Test Fase 5

- [x] 5.6 Tabel merender baris dari API.
- [x] 5.7 Klik halaman berikutnya mengirim `offset` yang benar.
- [x] 5.8 `has_more: false` menonaktifkan tombol berikutnya.
- [x] 5.9 Export memicu unduhan, bukan menampilkan CSV mentah di layar.

---

## Fase 6 — Administrasi (khusus admin)

### API key outlet

- [x] 6.1 Daftar — `GET /api/api-keys` (hanya `key_prefix`, tidak pernah key mentah).
- [x] 6.2 Buat — `POST /api/api-keys` `{outlet_code}`.
      Outlet yang sudah punya key ditolak **409** — tampilkan sebagai
      "outlet ini sudah punya key, gunakan Rotate", bukan "terjadi kesalahan".
- [x] 6.3 Rotate — `POST /api/api-keys/{outlet_code}/rotate`.
- [x] 6.4 Revoke — `POST /api/api-keys/{outlet_code}/revoke`.
- [x] 6.5 **Dialog key sekali-lihat.** `create` dan `rotate` adalah satu-satunya
      response yang memuat `api_key` mentah. Harus ada tombol salin dan
      peringatan jelas; kalau dialog ditutup, key itu hilang selamanya.
- [x] 6.6 Konfirmasi ketik-nama-outlet sebelum rotate/revoke — keduanya
      **langsung mematikan mesin POS di lapangan**.

### User

- [x] 6.7 Daftar — `GET /api/users`
- [x] 6.8 Buat — `POST /api/users` `{email, password, role, outlet_code?, full_name?}`
      (password minimal 8 karakter; role `outlet` **wajib** `outlet_code` → 422)
- [x] 6.9 Ubah — `PATCH /api/users/{id}` `{full_name?, role?, outlet_code?, is_active?}`
- [x] 6.10 Reset password — `POST /api/users/{id}/password`
- [x] 6.11 Tampilkan pagar backend sebagai UI, jangan biarkan jadi error 400: - akun sendiri tidak bisa dinonaktifkan / diturunkan → matikan tombolnya - admin aktif terakhir tidak bisa diturunkan / dinonaktifkan - `email` tidak bisa diubah → field dikunci saat edit

### Test Fase 6

- [x] 6.12 Key mentah tampil sekali dan bisa disalin.
- [x] 6.13 409 saat buat key duplikat → pesan mengarahkan ke Rotate.
- [x] 6.14 Rotate butuh konfirmasi ketik nama outlet.
- [x] 6.15 Tombol nonaktifkan mati untuk akun sendiri.
- [x] 6.16 Membuat user role `outlet` tanpa outlet → pesan validasi di field.

---

## Fase 7 — Status sync per outlet

- [x] 7.1 `GET /api/outlets/sync-status` — kapan tiap outlet terakhir mengirim data.
- [x] 7.2 Tandai outlet yang sudah lama tidak sync (POS mati / jaringan putus).
      Ini halaman paling berguna secara operasional — outlet yang diam berarti
      omzetnya hilang dari laporan, dan tidak ada yang memberi tahu.
- [x] 7.3 Auto-refresh berkala.

### Test Fase 7

- [x] 7.4 Outlet yang basi tampil dengan penanda.
- [x] 7.5 Outlet yang belum pernah sync tidak merender tanggal kosong.

---

## Fase 8 — Kualitas

E2E berjalan terhadap **backend tiruan** (`e2e/mock-backend.mjs`) yang meniru
kontrak FastAPI, bukan terhadap FastAPI sungguhan. Sengaja: seluruh lapisan
yang berisiko ada di sisi frontend — `proxy.ts`, Route Handler, cookie
httpOnly, refresh 401 — dan semuanya tetap teruji, sementara CI tidak perlu
Postgres maupun user ter-seed. Kontrak ke FastAPI diverifikasi terpisah
langsung ke server yang berjalan.

Playwright menyalakan sendiri backend tiruan lalu `next build && next start`
(bukan `next dev`) — yang sampai ke pengguna adalah hasil build, dan selisih
keduanya justru yang ingin ditangkap. Jalankan dengan `npm run test:e2e`.

- [x] 8.1 Playwright E2E: login → dashboard → transaksi → logout.
      `e2e/alur-utama.spec.ts`. Termasuk yang tidak terlihat dari layar:
      cookie sesi benar-benar `httpOnly` dan tidak terbaca `document.cookie`,
      `next=` mengembalikan user ke halaman yang tadi dituju, dan **401 di
      tengah sesi di-refresh diam-diam** tanpa user terlempar ke `/login`.
- [x] 8.2 E2E: alur buat & rotate API key.
      `e2e/api-key.spec.ts`. Key mentah disalin lewat clipboard sungguhan
      lalu dipastikan **hilang** setelah dialog ditutup; 409 mengarahkan ke
      Rotate; rotate dan revoke sama-sama menuntut kode outlet diketik ulang.
- [x] 8.3 E2E per role (admin, manager, outlet).
      `e2e/peran.spec.ts`. Manager membuka `/pengguna` mendapat 403 dan isi
      halamannya **tidak ikut terkirim**; role outlet hanya melihat tiga menu,
      tanpa pemilih outlet, dan tabelnya tidak pernah memuat OUTLET_002.
- [x] 8.4 GitHub Actions: lint + unit test + build + Playwright.
      `.github/workflows/ci.yml` — job `check` (lint, typecheck, unit test +
      ambang cakupan, build) dan job `e2e` (Playwright, laporan diunggah
      kalau gagal).
- [x] 8.5 Ambang cakupan test untuk `lib/` dan `hooks/`.
      Ambang 80% (stmt/branch/func/line) di `vitest.config.mts`, dijalankan
      lewat `npm run test:coverage`. Saat ini 89% stmt / 82% branch.

      Provider **istanbul**, bukan v8: `@vitest/coverage-v8` menuntut Node >=
          22 sedangkan mesin ini Node 20 dan diam-diam melaporkan 0%. Versinya
          juga harus dikunci sama dengan vitest (4.1.11) — `--legacy-peer-deps`
          sempat memasang v5 yang gagal dengan `coverageFilesDirectory is
          required`.

          `session.ts` dan `current-user.ts` dikecualikan: keduanya `server-only`
          dan memanggil `cookies()`, jadi tidak bisa dijalankan di jsdom sama
          sekali. Jalurnya diverifikasi langsung ke server yang berjalan.

- [x] 8.6 Error boundary + halaman 500.
      `app/(app)/error.tsx` (shell tetap terpasang, jadi user bisa pindah
      halaman), `app/global-error.tsx` (tanpa bergantung pada CSS aplikasi,
      karena dia menggantikan root layout), dan `app/not-found.tsx`.
      Yang ditampilkan hanya `digest`, bukan pesan error asli.
- [x] 8.7 Cek aksesibilitas dasar (fokus keyboard, label form, kontras).
      Dijalankan dengan **axe-core sungguhan** (`src/test/a11y.test.tsx`),
      bukan pemeriksaan manual: WCAG 2 A/AA pada form login, form ganti
      sandi, tabel status sync, dan halaman 403 — nol pelanggaran. Plus urutan
      Tab dan kirim-dengan-Enter.

      Warna grafik divalidasi terpisah terhadap permukaan kartu yang
          sebenarnya (`#ffffff` terang, `#171717` gelap): kontras >= 3:1 di kedua
          mode. Status sync dan penanda void selalu memakai ikon + teks, tidak
          pernah warna saja.

---

## Fase 9 — Deploy

- [x] 9.1 Dockerfile (multi-stage, `output: "standalone"`).
      Tiga tahap (deps → builder → runner), jalan sebagai user non-root.
      Terverifikasi: `.next/standalone/server.js` benar-benar dihasilkan.
- [x] 9.2 `API_BASE_URL` per environment.
      Dibaca saat runtime (bukan saat build), jadi satu image yang sama bisa
      dipakai di semua environment. `.env.example` ikut di-commit.
- [x] 9.3 ~~Tambahkan origin produksi ke `CORS_ORIGINS` backend~~
      **TIDAK DIPERLUKAN.** Opsi BFF dipilih di 0.2, jadi browser tidak
      pernah memanggil FastAPI langsung — semua request lewat Route Handler
      di origin yang sama. CORS tidak pernah ikut bermain.
- [x] 9.4 Jangan bocorkan secret ke bundel klien — hanya `NEXT_PUBLIC_*`
      yang boleh sampai ke browser.
      **Terverifikasi, bukan diasumsikan:** setelah `next build`, pencarian
      `API_BASE_URL` dan `localhost:8000` di `.next/static/` mengembalikan
      0 berkas. Tidak ada satu pun variabel `NEXT_PUBLIC_*` di proyek ini.

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
