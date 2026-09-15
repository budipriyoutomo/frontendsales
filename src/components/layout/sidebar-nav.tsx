"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  KeyRound,
  LayoutDashboard,
  ReceiptText,
  RefreshCw,
  Users,
} from "lucide-react";
import type { NavItem } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

const IKON = {
  dashboard: LayoutDashboard,
  transaksi: ReceiptText,
  sync: RefreshCw,
  kunci: KeyRound,
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

  return (
    <nav aria-label="Menu utama" className="flex flex-col gap-1">
      {items.map((item) => {
        const Ikon = IKON[item.icon];
        const aktif =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={aktif ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              aktif
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            <Ikon aria-hidden className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
