import type { components } from "@/types/api";

/**
 * Alias pendek untuk skema yang digenerate dari `/openapi.json`.
 *
 * Sengaja alias, bukan definisi ulang: kalau backend mengubah bentuk data,
 * `npm run gen:api` akan membuat kode di sini gagal dikompilasi — bukan
 * diam-diam berbeda saat dijalankan (lihat TODO 1.5).
 */
type S = components["schemas"];

export type Summary = S["SummaryData"];
export type DailyRow = S["DailyRow"];
export type OutletSalesRow = S["OutletSalesRow"];
export type TopProductRow = S["TopProductRow"];
export type Sale = S["SaleResponse"];
export type SaleDetail = S["SaleDetail"];
export type SaleItem = S["SaleItemResponse"];
export type SyncStatusRow = S["SyncStatusRow"];
export type Outlet = S["OutletResponse"];
export type ApiKey = S["ApiKeyResponse"];
export type UserAdmin = S["UserAdminResponse"];
export type Pagination = S["PaginationMeta"];
export type ProductGroupMapping = S["ProductGroupMappingResponse"];
export type ProductGroupSalesRow = S["ProductGroupSalesRow"];
export type ProductMenuMapping = S["ProductMenuMappingResponse"];
export type ProductMenuCandidate = S["ProductMenuCandidate"];
export type ProductMenuColorplate = S["ProductMenuColorplateResponse"];
export type Brand = S["BrandResponse"];
export type OutletBrand = S["OutletBrandResponse"];
export type ClosingMenu = S["ClosingMenuResponse"];
export type ClosingMenuProduct = S["ClosingMenuProductResponse"];
export type ClosingReportSummary = S["ClosingReportSummary"];
export type ClosingReportDetail = S["ClosingReportDetail"];
export type ClosingComparisonRow = S["ClosingComparisonRow"];
export type ClosingMessageSummary = S["ClosingMessageSummary"];
export type ClosingMessageDetail = S["ClosingMessageDetail"];
export type ClosingMessageCounts = S["ClosingMessageCounts"];
export type Product = S["ProductResponse"];
export type ProductPosMapping = S["ProductPosMappingResponse"];
export type PosCandidate = S["PosCandidateResponse"];
