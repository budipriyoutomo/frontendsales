import type { Metadata } from "next";
import { SyncStatusView } from "@/components/sync/sync-status-view";

export const metadata: Metadata = {
  title: "Status Sync — Maharasa Sync",
};

export default function StatusSyncPage() {
  return <SyncStatusView />;
}
