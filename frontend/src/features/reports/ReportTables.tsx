import { movementLabels } from "../inventory/movementTypes";
import { manilaTime, peso, type InventorySummary, type LowStock, type MovementRow } from "./reports";

export function InventoryMetrics({ data }: { data: InventorySummary }) {
  const entries = [
    ["Physical units", data.totalStockUnits], ["Sellable units", data.sellableStockUnits],
    ["Inventory cost value", peso.format(Number(data.inventoryCostValue))], ["Active products", data.totalActiveProducts],
    ["Low-stock products", data.lowStockProducts], ["Out of stock", data.outOfStockProducts],
  ];
  return <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
    {entries.map(([name, value]) => <div key={name} className="rounded-lg bg-slate-50 p-3">
      <dt className="text-sm text-slate-600">{name}</dt><dd className="mt-1 break-words text-xl font-semibold tabular-nums">{value}</dd>
    </div>)}
  </dl>;
}

export function LowStockTable({ rows }: { rows: LowStock[] }) {
  if (!rows.length) return <p className="mt-3 text-sm text-slate-600">All active products are above their reorder levels.</p>;
  return <div className="mt-3 max-h-96 overflow-auto"><table className="w-full text-left text-sm">
    <thead className="sticky top-0 bg-slate-50"><tr>{["Product", "On hand", "Reorder level"].map(h => <th scope="col" key={h} className="p-3">{h}</th>)}</tr></thead>
    <tbody className="divide-y divide-slate-100">{[...rows].sort((a,b) => a.stockQuantity-b.stockQuantity).map(p => <tr key={p.id}>
      <td className="p-3 font-medium">{p.name}<span className="block text-xs text-slate-500">{p.sku}</span></td>
      <td className={"p-3 font-semibold " + (p.stockQuantity === 0 ? "text-red-700" : "text-amber-800")}>{p.stockQuantity}</td><td className="p-3">{p.reorderLevel}</td>
    </tr>)}</tbody>
  </table></div>;
}

export function MovementTable({ rows }: { rows: MovementRow[] }) {
  if (!rows.length) return <p className="mt-3 text-sm text-slate-600">No matching movements.</p>;
  return <div className="mt-4 max-h-96 overflow-auto"><table className="w-full text-left text-sm">
    <thead className="sticky top-0 bg-slate-50"><tr>{["Date (Manila)", "Product", "Movement", "Change", "Balance after", "Notes"].map(h => <th scope="col" key={h} className="whitespace-nowrap p-3">{h}</th>)}</tr></thead>
    <tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={row.id}>
      <td className="whitespace-nowrap p-3">{manilaTime.format(new Date(row.createdAt))}</td>
      <td className="p-3 font-medium">{row.product.name}<span className="block text-xs text-slate-500">{row.product.sku}</span></td>
      <td className="p-3">{movementLabels[row.type]}</td><td className="p-3">{["SALE","RETURN_OUT","ADJUSTMENT_OUT"].includes(row.type) ? "−" : "+"}{row.quantity}</td>
      <td className="p-3">{row.quantityAfter}</td><td className="min-w-32 break-words p-3">{row.notes || "—"}</td>
    </tr>)}</tbody>
  </table></div>;
}
