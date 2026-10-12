"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  Inbox,
  KeyRound,
  Link2,
  Layers,
  LayoutDashboard,
  Package,
  ReceiptText,
  RefreshCw,
  Store,
  Users,
} from "lucide-react";
import { NAV_SECTIONS, type NavItem } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

const IKON = {
  dashboard: LayoutDashboard,
  transaksi: ReceiptText,
  sync: RefreshCw,
  closing: ClipboardCheck,
  mapping: Link2,
  pesan: Inbox,
  kunci: KeyRound,
  group: Layers,
  brand: Store,
  produk: Package,
  pengguna: Users,
} as const;

export function SidebarNav({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const kelompok = NAV_SECTIONS.map((s) => ({
    ...s,
    items: items.filter((i) => i.section === s.id),
  })).filter((s) => s.items.length > 0);
  // Satu kelompok saja (role outlet) tidak perlu judul kelompok.
  const pakaiJudul = kelompok.length > 1;

  return (
    <nav aria-label="Menu utama" className="flex flex-col gap-4">
      {kelompok.map((k) => (
        <div
          key={k.id}
          role="group"
          aria-labelledby={pakaiJudul ? `nav-${k.id}` : undefined}
          className="flex flex-col gap-1"
        >
          {pakaiJudul ? (
            <p
              id={`nav-${k.id}`}
              className="text-sidebar-foreground/60 px-3 pb-1 text-xs font-medium tracking-wide uppercase"
            >
              {k.label}
            </p>
          ) : null}

          {k.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              aktif={
                pathname === item.href || pathname.startsWith(`${item.href}/`)
              }
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

function NavLink({
  item,
  aktif,
  onNavigate,
}: {
  item: NavItem;
  aktif: boolean;
  onNavigate?: () => void;
}) {
  const Ikon = IKON[item.icon];

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={aktif ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        aktif
          ? "bg-primary/10 text-primary"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      <Ikon aria-hidden className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}
