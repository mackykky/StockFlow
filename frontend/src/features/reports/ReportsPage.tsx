import { useState } from "react";
import { useApi } from "../../hooks/useApi";
import { hasPermission } from "../auth/permissions";
import { useAuth } from "../auth/useAuth";
import { movementLabels } from "../inventory/movementTypes";
import ProductPicker from "../inventory/ProductPicker";
import type { Product } from "../products/product.types";
import { InventoryMetrics, MovementTable } from "./ReportTables";
import { button, panel, type InventorySummary, type MovementRow } from "./reports";
import { useReport } from "./useReport";

const field = "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
const pageSize = 25;

export default function ReportsPage() {
  const { user } = useAuth();
  const { fetchResponse } = useApi();
  const privileged = hasPermission(user?.role, "reports:cost");
  const [revision, refresh] = useState(0);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [downloading, setDownloading] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const summary = useReport<InventorySummary>(privileged ? "/reports/inventory-summary" : null, revision);
  const products = useReport<Product[]>("/products", revision);
  const movements = useReport<MovementRow[]>("/reports/stock-movements" + query, revision);
  const rows = movements?.data;
  const pages = Math.max(1, Math.ceil((rows?.length ?? 0) / pageSize));
  const currentPage = Math.min(page, pages - 1);

  async function download(report: "inventory-summary" | "stock-movements") {
    setDownloadError("");
    setDownloading(report);
    try {
      const filters = report === "stock-movements" ? query : "";
      const response = await fetchResponse("/reports/" + report + "/export" + filters);
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "stockflow-" + report + ".csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Unable to download report.");
    } finally {
      setDownloading("");
    }
  }

  return <main className="space-y-5 text-slate-900">
    <header className="flex items-center justify-between gap-3"><h1 className="text-2xl font-bold">Reports</h1>
      <button className={button} onClick={() => refresh(value => value + 1)}>Refresh</button></header>
    {downloadError && <p role="alert" className="text-red-700">{downloadError}</p>}
    {privileged && <section className={panel}><div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">Inventory summary</h2>
      <button className={button} disabled={!!downloading} onClick={() => download("inventory-summary")}>{downloading === "inventory-summary" ? "Downloading…" : "Download inventory CSV"}</button></div>
      {summary?.data ? <InventoryMetrics data={summary.data} /> : <p role="status">{summary?.error ?? "Loading inventory summary…"}</p>}
    </section>}
    <section className={panel}><h2 className="text-lg font-semibold">Stock movements</h2>
      <form className="my-4 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={event => {
        event.preventDefault();
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries({ productId, type, startDate, endDate })) {
          if (value) params.set(key, value);
        }
        setQuery(params.size ? "?" + params.toString() : "");
        setPage(0);
      }}>
        <ProductPicker products={products?.data ?? []} selected={products?.data?.find(p => String(p.id) === productId)} disabled={!products?.data} onSelect={setProductId} />
        <label>Movement type<select className={field} value={type} onChange={e => setType(e.target.value)}><option value="">All movements</option>
          {Object.entries(movementLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        <label>From (Manila)<input type="date" className={field} value={startDate} max={endDate || undefined} onChange={e => setStartDate(e.target.value)} /></label>
        <label>Through (Manila)<input type="date" className={field} value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} /></label>
        <button className={button} type="submit">Apply filters</button>
      </form>
      {products?.error && <p role="alert">Product search unavailable. {products.error}</p>}
      {rows ? <>
        <div className="flex flex-wrap items-center justify-between gap-3"><span role="status">{rows.length} matching movements</span>
          <button className={button} disabled={!!downloading} onClick={() => download("stock-movements")}>{downloading === "stock-movements" ? "Downloading…" : "Download movements CSV"}</button></div>
        <MovementTable rows={rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)} />
        {pages > 1 && <nav className="mt-4 flex items-center gap-3 text-sm" aria-label="Movement pages">
          <button className={button} disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <span>Page {currentPage + 1} of {pages}</span><button className={button} disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></nav>}
      </> : <p role="status">{movements?.error ?? "Loading stock movements…"}</p>}
    </section>
  </main>;
}
