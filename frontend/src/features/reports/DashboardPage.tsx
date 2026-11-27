import { useState } from "react";
import { Link } from "react-router";
import { hasPermission } from "../auth/permissions";
import { useAuth } from "../auth/useAuth";
import { InventoryMetrics, LowStockTable, MovementTable } from "./ReportTables";
import { button, panel, peso, type Dashboard, type LowStock } from "./reports";
import { useReport } from "./useReport";

const heading = "text-lg font-semibold";

export default function DashboardPage() {
  const { user } = useAuth();
  const privileged = hasPermission(user?.role, "reports:cost");
  const [revision, refresh] = useState(0);
  const dashboard = useReport<Dashboard>(privileged ? "/reports/dashboard" : null, revision);
  const stock = useReport<LowStock[]>(privileged ? null : "/reports/low-stock", revision);
  const data = dashboard?.data;
  const rows = data?.lowStockProducts ?? stock?.data;
  const error = dashboard?.error ?? stock?.error;

  return <main className="space-y-5 text-slate-900">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="flex gap-2"><Link className={button} to="/reports">View reports</Link>
        <button className={button} onClick={() => refresh(value => value + 1)}>Refresh</button></div>
    </header>
    {error && <p role="alert">{error}</p>}
    {!error && !rows && <p role="status">Loading dashboard…</p>}
    {data && <>
      <section className={panel}><h2 className={heading}>Inventory overview</h2><InventoryMetrics data={data.inventory} /></section>
      <section className={panel}><h2 className={heading}>Completed sales</h2>
        <div className="my-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Today", count: data.sales.todayCount, revenue: data.sales.todayTotal },
            { label: "Yesterday", count: data.sales.yesterdayCount, revenue: data.sales.yesterdayTotal },
            { label: "Last 7 days", count: data.salesTrends.totalSales, revenue: data.salesTrends.totalRevenue },
          ].map(({ label, count, revenue }) => <div key={label} className="rounded-lg bg-blue-50 p-3">
            <h3 className="text-sm text-slate-700">{label}</h3><strong className="block text-xl">{peso.format(Number(revenue))}</strong>
            <span className="text-sm">{count} {count === 1 ? "transaction" : "transactions"}</span>
          </div>)}
        </div>
        <table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200"><th>Date (Manila)</th><th className="text-right">Transactions</th><th className="text-right">Revenue</th></tr></thead>
          <tbody>{data.salesTrends.dailySales.map(day => <tr key={day.date} className="border-b border-slate-100"><td className="py-2">{day.date}</td>
            <td className="text-right">{day.salesCount}</td><td className="text-right tabular-nums">{peso.format(Number(day.revenue))}</td></tr>)}</tbody>
        </table>
      </section>
      <section className={panel}><h2 className={heading}>Top-selling products</h2>
        <p className="text-sm text-slate-600">Units sold across all completed sales</p>
        {data.topSellingProducts.length ? <ol className="mt-3 divide-y divide-slate-100">{data.topSellingProducts.map(({ product, totalQuantitySold }) =>
          <li key={product.id} className="flex items-center justify-between gap-4 py-2"><span>{product.name}<small className="block text-slate-500">{product.sku}</small></span><strong>{totalQuantitySold}</strong></li>)}</ol> : <p className="mt-3">No completed sales yet.</p>}
      </section>
    </>}
    {rows && <section className={panel}><h2 className={heading}>Low-stock products</h2><LowStockTable rows={rows} /></section>}
    {data && <section className={panel}><h2 className={heading}>Recent stock movements</h2><MovementTable rows={data.recentMovements} /></section>}
  </main>;
}
