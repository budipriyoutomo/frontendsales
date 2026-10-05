"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterBar } from "@/components/dashboard/filter-bar";
import {
  KartuSkeleton,
  KeadaanGagal,
  KeadaanKosong,
} from "@/components/dashboard/states";
import { ClosingDetailDialog } from "@/components/closing/closing-detail-dialog";
import { ClosingStatusBadge } from "@/components/closing/closing-status-badge";
import {
  LIMIT_LAPORAN,
  useClosingComparison,
  useClosingReports,
} from "@/hooks/use-closing";
import {
  BERMASALAH,
  STATUS_PERBANDINGAN,
  formatSelisih,
  hitungPerStatus,
  saringPerbandingan,
  type SaringStatus,
  type StatusPerbandingan,
} from "@/lib/closing";
import { bacaFilter, filterKeQuery, type Filter } from "@/lib/filter";
import {
  formatAngka,
  formatTanggal,
  formatTanggalWaktuUtc,
} from "@/lib/format";
import type { Role } from "@/lib/auth/current-user";
import type { ClosingComparisonRow } from "@/types/domain";
import { cn } from "@/lib/utils";

const TAB_LAPORAN = "laporan";
const TAB_PERBANDINGAN = "perbandingan";

/**
 * Closing report dari sistem lain (RabbitMQ) dan perbandingannya dengan
 * penjualan POS. Filter tanggal = tanggal produksi untuk perbandingan, dan
 * tanggal closing untuk daftar laporan.
 */
export function ClosingView({ role }: { role: Role }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filter = useMemo(
    () => bacaFilter(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const tab =
    searchParams.get("tab") === TAB_LAPORAN ? TAB_LAPORAN : TAB_PERBANDINGAN;

  function gantiTab(berikutnya: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (berikutnya === TAB_LAPORAN) params.set("tab", TAB_LAPORAN);
    else params.delete("tab");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Closing Report
        </h1>
        <p className="text-muted-foreground text-sm">
          Laporan closing harian per outlet (terjual, waste, adjustment,
          kompensasi) yang dikirim sistem closing, dibandingkan dengan penjualan
          POS.
        </p>
      </div>

      <FilterBar role={role} tanpaBrand />

      <Tabs value={tab} onValueChange={gantiTab}>
        <TabsList>
          <TabsTrigger value={TAB_PERBANDINGAN}>Perbandingan POS</TabsTrigger>
          <TabsTrigger value={TAB_LAPORAN}>Daftar laporan</TabsTrigger>
        </TabsList>
        <TabsContent value={TAB_PERBANDINGAN} className="pt-4">
          <Perbandingan filter={filter} role={role} />
        </TabsContent>
        <TabsContent value={TAB_LAPORAN} className="pt-4">
          {/* Ganti filter = mulai dari halaman pertama lagi. */}
          <DaftarLaporan
            key={JSON.stringify(filterKeQuery(filter))}
            filter={filter}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const URUTAN_STATUS: StatusPerbandingan[] = [
  "selisih",
  "tidak_ada_di_closing",
  "belum_dipetakan",
  "cocok",
];

function Perbandingan({ filter, role }: { filter: Filter; role: Role }) {
  const [saring, setSaring] = useState<SaringStatus | undefined>();
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const query = useClosingComparison(filter, includeDeleted);

  const semua = query.data ?? [];
  const jumlah = hitungPerStatus(semua);
  const bermasalah = semua.length - jumlah.cocok;
  const baris = saringPerbandingan(semua, saring);

  const toggle = (s: SaringStatus) =>
    setSaring((now) => (now === s ? undefined : s));

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Saring per status"
          >
            <TombolSaring
              label="Perlu dicek"
              jumlah={bermasalah}
              aktif={saring === BERMASALAH}
              onClick={() => toggle(BERMASALAH)}
            />
            {URUTAN_STATUS.map((s) => (
              <TombolSaring
                key={s}
                label={STATUS_PERBANDINGAN[s].label}
                jumlah={jumlah[s]}
                aktif={saring === s}
                onClick={() => toggle(s)}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="closing-void"
              checked={includeDeleted}
              onCheckedChange={setIncludeDeleted}
            />
            <Label htmlFor="closing-void">Ikutkan transaksi void</Label>
          </div>
        </div>

        <p className="text-muted-foreground text-sm">
          Dibandingkan per produk POS pada tanggal produksi yang sama. Closing =
          Σ (terjual + adjustment + kompensasi) × pengali dari semua menu yang
          dipetakan ke produk itu. Selisih = qty POS − (terjual + adjustment +
          kompensasi) closing — rumus yang sama dengan sistem closing.
        </p>

        {jumlah.belum_dipetakan > 0 && role === "admin" ? (
          <p className="text-sm">
            {formatAngka(jumlah.belum_dipetakan)} baris belum bisa dibandingkan
            karena menunya belum dipetakan ke ProductID POS.{" "}
            <Link
              href="/closing-menu"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Petakan menu
            </Link>
          </p>
        ) : null}

        {query.isPending ? (
          <KartuSkeleton baris={8} />
        ) : query.isError ? (
          <KeadaanGagal error={query.error} onCobaLagi={query.refetch} />
        ) : semua.length === 0 ? (
          <KeadaanKosong
            judul="Belum ada closing report"
            keterangan="Tidak ada closing pada rentang tanggal produksi ini."
          />
        ) : baris.length === 0 ? (
          <KeadaanKosong
            judul="Tidak ada baris"
            keterangan="Tidak ada baris dengan status ini."
          />
        ) : (
          <div
            className={cn(
              "overflow-x-auto",
              query.isFetching && "opacity-60 transition-opacity",
            )}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tgl. produksi</TableHead>
                  <TableHead>Outlet</TableHead>
                  <TableHead>Produk POS</TableHead>
                  <TableHead>Menu closing</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                  <TableHead className="text-right">POS</TableHead>
                  <TableHead className="text-right">Selisih</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baris.map((b) => (
                  <TableRow
                    key={`${b.outlet_code}-${b.production_date}-${b.product_id ?? b.menus?.[0]?.menu_id}`}
                  >
                    <TableCell className="whitespace-nowrap">
                      {formatTanggal(b.production_date)}
                    </TableCell>
                    <TableCell className="font-mono">{b.outlet_code}</TableCell>
                    <TableCell>
                      {b.product_id ? (
                        <>
                          <div className="font-medium">
                            {b.product_name ?? "—"}
                          </div>
                          <div className="text-muted-foreground font-mono text-xs">
                            {b.product_id}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <MenuPerbandingan menus={b.menus ?? []} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAngka(b.closing_qty)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAngka(b.pos_qty)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatSelisih(b.selisih)}
                    </TableCell>
                    <TableCell>
                      <ClosingStatusBadge status={b.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TombolSaring({
  label,
  jumlah,
  aktif,
  onClick,
}: {
  label: string;
  jumlah: number;
  aktif: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={aktif ? "default" : "outline"}
      aria-pressed={aktif}
      onClick={onClick}
    >
      {label}
      <span className="tabular-nums opacity-80">{formatAngka(jumlah)}</span>
    </Button>
  );
}

/** Menu closing yang membentuk angka closing satu baris produk. */
function MenuPerbandingan({
  menus,
}: {
  menus: NonNullable<ClosingComparisonRow["menus"]>;
}) {
  if (menus.length === 0) {
    return <span className="text-muted-foreground text-sm">Tidak ada</span>;
  }
  return (
    <ul className="space-y-1">
      {menus.map((m) => (
        <li key={m.menu_id}>
          <div className="font-medium">
            {m.menu_name}
            {m.menu_code ? (
              <span className="text-muted-foreground ml-1 font-mono text-xs">
                {m.menu_code}
              </span>
            ) : null}
          </div>
          <div className="text-muted-foreground text-xs tabular-nums">
            terjual {formatAngka(m.sold)} · adj {formatSelisih(m.adjustment)} ·
            komp {formatAngka(m.compensation)}
            {m.multiplier && m.multiplier !== 1 ? ` · × ${m.multiplier}` : ""}
          </div>
        </li>
      ))}
    </ul>
  );
}

function DaftarLaporan({ filter }: { filter: Filter }) {
  const [offset, setOffset] = useState(0);
  const [dipilih, setDipilih] = useState<string | null>(null);
  const query = useClosingReports(filter, offset);

  const baris = query.data?.data ?? [];
  const pagination = query.data?.pagination;
  const halaman = Math.floor(offset / LIMIT_LAPORAN) + 1;
  const totalHalaman = pagination
    ? Math.max(1, Math.ceil(pagination.total / LIMIT_LAPORAN))
    : 1;

  return (
    <Card>
      <CardContent className="pt-6">
        {query.isPending ? (
          <KartuSkeleton baris={6} />
        ) : query.isError ? (
          <KeadaanGagal error={query.error} onCobaLagi={query.refetch} />
        ) : baris.length === 0 ? (
          <KeadaanKosong
            judul="Belum ada closing report"
            keterangan="Tidak ada closing pada rentang tanggal ini."
          />
        ) : (
          <div
            className={
              query.isFetching ? "opacity-60 transition-opacity" : undefined
            }
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tgl. closing</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead className="text-right">Item</TableHead>
                    <TableHead className="text-right">Revisi</TableHead>
                    <TableHead>Dikirim</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {baris.map((r) => (
                    <TableRow key={r.closing_report_id}>
                      <TableCell className="whitespace-nowrap">
                        {formatTanggal(r.report_date)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.outlet_name}</div>
                        <div className="text-muted-foreground font-mono text-xs">
                          {r.outlet_code}
                        </div>
                      </TableCell>
                      <TableCell>{r.brand_name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAngka(r.item_count)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAngka(r.revision_count)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTanggalWaktuUtc(r.sent_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDipilih(r.closing_report_id)}
                        >
                          Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-sm">
                {pagination
                  ? `Halaman ${halaman} dari ${totalHalaman} · ${formatAngka(pagination.total)} laporan`
                  : null}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - LIMIT_LAPORAN))}
                >
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination?.has_more}
                  onClick={() => setOffset(offset + LIMIT_LAPORAN)}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <ClosingDetailDialog
        closingReportId={dipilih}
        onClose={() => setDipilih(null)}
      />
    </Card>
  );
}
