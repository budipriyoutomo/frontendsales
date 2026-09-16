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
  icon: "dashboard" | "transaksi" | "sync" | "kunci" | "group" | "pengguna";
  roles: readonly Role[];
};

const SEMUA: readonly Role[] = ["admin", "manager", "outlet"];

export const NAV: readonly NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    roles: SEMUA,
  },
  {
    href: "/transaksi",
    label: "Transaksi",
    icon: "transaksi",
    roles: SEMUA,
  },
  {
    href: "/status-sync",
    label: "Status Sync",
    icon: "sync",
    roles: SEMUA,
  },
  {
    href: "/api-keys",
    label: "API Key",
    icon: "kunci",
    roles: ["admin"],
  },
  {
    // Menentukan event apa yang diterima consumer RabbitMQ — sama sensitifnya
    // dengan API key, jadi manager pun tidak (TODO 10.4).
    href: "/product-group",
    label: "Product Group",
    icon: "group",
    roles: ["admin"],
  },
  {
    href: "/pengguna",
    label: "Pengguna",
    icon: "pengguna",
    roles: ["admin"],
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
