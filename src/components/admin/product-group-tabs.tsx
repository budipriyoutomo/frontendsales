"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ProductGroupsView } from "@/components/admin/product-groups-view";
import { ProductMenusView } from "@/components/admin/product-menus-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TAB_GROUP = "group";
const TAB_MENU = "menu";

/**
 * Halaman Product Group: daftar group dan konversi menu satuan, dipisah
 * per tab. Tab aktif ikut di URL (`?tab=menu`) seperti halaman Closing,
 * supaya tautannya bisa dibagikan dan tombol back mengembalikannya.
 */
export function ProductGroupTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = searchParams.get("tab") === TAB_MENU ? TAB_MENU : TAB_GROUP;

  function gantiTab(berikutnya: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (berikutnya === TAB_MENU) params.set("tab", TAB_MENU);
    else params.delete("tab");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Group"
        description="Atur group yang dipublish ke RabbitMQ dan konversi menu satuan ke warna colorplate."
      />

      <Tabs value={tab} onValueChange={gantiTab}>
        <TabsList>
          <TabsTrigger value={TAB_GROUP}>Group</TabsTrigger>
          <TabsTrigger value={TAB_MENU}>Menu satuan</TabsTrigger>
        </TabsList>
        <TabsContent value={TAB_GROUP} className="pt-4">
          <ProductGroupsView />
        </TabsContent>
        <TabsContent value={TAB_MENU} className="pt-4">
          <ProductMenusView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
