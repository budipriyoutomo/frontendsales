import type { Metadata } from "next";
import { PengaturanView } from "@/components/tampilan/pengaturan-view";

export const metadata: Metadata = {
  title: "Pengaturan — Maharasa Sync",
};

/** Terbuka untuk semua role: hanya mengatur tampilan di browser sendiri. */
export default function PengaturanPage() {
  return <PengaturanView />;
}
