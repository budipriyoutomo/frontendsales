"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";
import type { NavItem } from "@/lib/auth/access";
import type { CurrentUser } from "@/lib/auth/current-user";

/**
 * Shell aplikasi: sidebar + topbar + area konten (TODO 3.1).
 * Di layar kecil sidebar berubah jadi drawer (TODO 3.6).
 */
export function AppShell({
  user,
  nav,
  children,
}: {
  user: CurrentUser;
  nav: NavItem[];
  children: ReactNode;
}) {
  const [drawerTerbuka, setDrawerTerbuka] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-background sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4">
        <Sheet open={drawerTerbuka} onOpenChange={setDrawerTerbuka}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Buka menu"
            >
              <Menu aria-hidden className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader>
              <SheetTitle>Maharasa Sync</SheetTitle>
            </SheetHeader>
            <div className="px-3 pb-4">
              <SidebarNav
                items={nav}
                onNavigate={() => setDrawerTerbuka(false)}
              />
            </div>
          </SheetContent>
        </Sheet>

        <Link href="/dashboard" className="font-semibold tracking-tight">
          Maharasa Sync
        </Link>

        <div className="ml-auto">
          <UserMenu user={user} />
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="bg-sidebar hidden w-60 shrink-0 border-r p-3 md:block">
          <SidebarNav items={nav} />
        </aside>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
