import type { MovementType } from "../inventory/movementTypes";

export interface InventorySummary {
  totalActiveProducts: number;
  totalStockUnits: number;
  sellableStockUnits: number;
  inventoryCostValue: string;
  lowStockProducts: number;
  outOfStockProducts: number;
}

export interface LowStock {
  id: number; name: string; sku: string; stockQuantity: number; reorderLevel: number;
}

export interface MovementRow {
  id: number; product: { name: string; sku: string }; createdAt: string;
  type: MovementType; quantity: number; quantityAfter: number; notes: string | null;
}

export interface Dashboard {
  inventory: InventorySummary;
  sales: { todayCount: number; todayTotal: string; yesterdayCount: number; yesterdayTotal: string };
  salesTrends: {
    totalRevenue: string; totalSales: number;
    dailySales: { date: string; salesCount: number; revenue: string }[];
  };
  topSellingProducts: { product: { id: number; name: string; sku: string }; totalQuantitySold: number }[];
  lowStockProducts: LowStock[];
  recentMovements: MovementRow[];
}

export const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
export const manilaTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
});
export const panel = "min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
export const button = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
