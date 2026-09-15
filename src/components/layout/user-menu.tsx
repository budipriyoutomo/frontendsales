"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api/browser";
import type { CurrentUser } from "@/lib/auth/current-user";

const NAMA_ROLE: Record<CurrentUser["role"], string> = {
  admin: "Admin",
  manager: "Manager",
  outlet: "Outlet",
};

/** Menu user: nama, role, outlet, ganti password, keluar (TODO 3.5). */
export function UserMenu({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const [keluar, setKeluar] = useState(false);

  async function logout() {
    setKeluar(true);
    try {
      await api.request("/api/auth/logout", { method: "POST" });
    } catch {
      // Cookie tetap dibersihkan server; kalaupun gagal, tetap ke /login.
    }
    router.push("/login");
    router.refresh();
  }

  const nama = user.full_name?.trim() || user.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2">
          <span className="max-w-40 truncate">{nama}</span>
          <ChevronDown aria-hidden className="size-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-medium">{nama}</span>
          <span className="text-muted-foreground block truncate text-xs">
            {user.email}
          </span>
          <span className="text-muted-foreground mt-1 block text-xs">
            {NAMA_ROLE[user.role]}
            {user.outlet_code ? ` · ${user.outlet_code}` : ""}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/ganti-password">
            <KeyRound aria-hidden className="size-4" />
            Ganti kata sandi
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          variant="destructive"
          disabled={keluar}
          onSelect={(e) => {
            e.preventDefault();
            void logout();
          }}
        >
          <LogOut aria-hidden className="size-4" />
          {keluar ? "Keluar…" : "Keluar"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
