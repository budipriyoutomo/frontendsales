import type { Role } from "@/lib/auth/current-user";

/**
 * Hak akses per halaman (TODO Fase 3).
 *
 * Ini **bukan** lapisan keamanan — backend yang menjaga, dan untuk role
 * `outlet` scope bahkan diambil dari identitas, bukan dari query. Tabel ini
 * ada supaya user tidak ditawari pintu yang akan ditutup di depan mukanya.
 */

export type NavItem = {
  href: string;
  label: string;
  /** Ikon lucide, dipilih di komponen sidebar. */
  icon:
    | "dashboard"
    | "transaksi"
    | "sync"
    | "closing"
    | "mapping"
    | "pesan"
    | "kunci"
    | "group"
    | "brand"
    | "produk"
    | "pengguna";
  roles: readonly Role[];
  /** Kelompok di sidebar; urutan kelompok mengikuti `NAV_SECTIONS`. */
  section: NavSection;
};

export type NavSection = "laporan" | "master" | "integrasi" | "admin";

export const NAV_SECTIONS: readonly { id: NavSection; label: string }[] = [
  { id: "laporan", label: "Laporan" },
  { id: "master", label: "Master data" },
  { id: "integrasi", label: "Integrasi" },
  { id: "admin", label: "Admin" },
];

const SEMUA: readonly Role[] = ["admin", "manager", "outlet"];

export const NAV: readonly NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    roles: SEMUA,
    section: "laporan",
  },
  {
    href: "/transaksi",
    label: "Transaksi",
    icon: "transaksi",
    roles: SEMUA,
    section: "laporan",
  },
  {
    href: "/status-sync",
    label: "Status Sync",
    icon: "sync",
    roles: SEMUA,
    section: "laporan",
  },
  {
    // Data closing ter-scope per outlet di backend, sama seperti transaksi.
    href: "/closing",
    label: "Closing",
    icon: "closing",
    roles: SEMUA,
    section: "laporan",
  },
  {
    // Master data dan mapping ProductID POS — sama seperti brand, hanya admin
    // yang mengubah. Manager tetap bisa membaca lewat API.
    href: "/produk",
    label: "Produk",
    icon: "produk",
    roles: ["admin"],
    section: "master",
  },
  {
    // Mengubah irisan laporan semua orang — manager cukup memakai filternya.
    href: "/brand",
    label: "Brand",
    icon: "brand",
    roles: ["admin"],
    section: "master",
  },
  {
    // Menentukan event apa yang diterima consumer RabbitMQ — sama sensitifnya
    // dengan API key, jadi manager pun tidak (TODO 10.4).
    href: "/product-group",
    label: "Product Group",
    icon: "group",
    roles: ["admin"],
    section: "master",
  },
  {
    // Mapping mengubah angka perbandingan semua outlet — sama seperti
    // mapping product group, hanya admin.
    href: "/closing-menu",
    label: "Mapping Closing",
    icon: "mapping",
    roles: ["admin"],
    section: "integrasi",
  },
  {
    // Payload mentah semua outlet, termasuk pesan yang ditolak — hanya admin,
    // sama seperti backend /api/closing-messages.
    href: "/closing-pesan",
    label: "Pesan RabbitMQ",
    icon: "pesan",
    roles: ["admin"],
    section: "integrasi",
  },
  {
    href: "/api-keys",
    label: "API Key",
    icon: "kunci",
    roles: ["admin"],
    section: "integrasi",
  },
  {
    href: "/pengguna",
    label: "Pengguna",
    icon: "pengguna",
    roles: ["admin"],
    section: "admin",
  },
];

export function navUntukRole(role: Role): NavItem[] {
  return NAV.filter((item) => item.roles.includes(role));
}

export function bolehMasukHalaman(role: Role, pathname: string): boolean {
  // Yang paling panjang menang, supaya `/transaksi/T-1` tidak keliru cocok
  // dengan entri lain yang kebetulan berawalan sama.
  const item = [...NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));

  // Halaman yang tidak terdaftar (mis. ganti password) terbuka untuk siapa
  // pun yang sudah masuk.
  if (!item) return true;

  return item.roles.includes(role);
}

/**
 * Untuk role `outlet`, server mengabaikan `?outlet=` dan memakai outlet dari
 * identitas. Menampilkan pemilih yang tidak berefek hanya membingungkan.
 */
export function bolehLihatPemilihOutlet(role: Role): boolean {
  return role !== "outlet";
}
