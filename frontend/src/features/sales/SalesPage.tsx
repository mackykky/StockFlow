import { useEffect, useRef, useState } from "react";
import { useApi, ApiError } from "../../hooks/useApi";
import ProductPicker from "../inventory/ProductPicker";
import type { Product } from "../products/product.types";

type Sale = {
  id: number; saleNumber: string; total: string; status: string;
  createdAt: string; notes: string | null; soldById: number;
};
type SaleDetails = Sale & {
  items: { productId: number; quantity: number; unitPrice: string; lineTotal: string }[];
};
type CartLine = { productId: number; quantity: string };

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const panel = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const button = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50";

export default function SalesPage() {
  const { request } = useApi();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<SaleDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [receiptError, setReceiptError] = useState("");
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const receiptRequest = useRef<AbortController | null>(null);
  const receiptPanel = useRef<HTMLElement>(null);
  const revealReceipt = useRef(false);

  useEffect(() => {
    if (!receipt || !revealReceipt.current || !receiptPanel.current) return;
    revealReceipt.current = false;
    receiptPanel.current.focus({ preventScroll: true });
    receiptPanel.current.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [receipt]);

  useEffect(() => () => receiptRequest.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    Promise.all([request<Product[]>("/products", options), request<Sale[]>("/sales", options)])
      .then(([items, records]) => {
        if (controller.signal.aborted) return;
        setProducts(items);
        setSales(records.sort((a, b) => b.id - a.id));
        setLoadError("");
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setLoadError(err instanceof Error ? err.message : "Unable to load sales.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [request, revision]);

  function refresh() {
    setLoading(true);
    setRevision(value => value + 1);
  }

  const byId = new Map(products.map(product => [product.id, product]));
  const lines = cart.map(line => {
    const product = byId.get(line.productId);
    const units = Number(line.quantity);
    let issue = "";
    if (!product?.isActive) issue = "This product is unavailable for sale.";
    else if (!Number.isSafeInteger(units) || units < 1) issue = "Enter a positive whole quantity.";
    else if (units > product.stockQuantity) issue = "Insufficient stock. Available: " + product.stockQuantity + ".";
    const cents = product && Number.isSafeInteger(units) && units > 0
      ? Math.round(Number(product.sellingPrice) * 100) * units : 0;
    return { ...line, product, issue, cents };
  });
  const total = lines.reduce((sum, line) => sum + line.cents, 0);
  const canSubmit = lines.length > 0 && !lines.some(line => line.issue) && !saving && !loading && !loadError;

  function add(id: string) {
    const productId = Number(id);
    setError("");
    setNotice("");
    setCart(current => current.some(line => line.productId === productId)
      ? current.map(line => line.productId === productId ? { productId, quantity: String(Number(line.quantity) + 1) } : line)
      : [...current, { productId, quantity: "1" }]);
  }

  async function checkout() {
    if (!canSubmit) return;
    receiptRequest.current?.abort();
    setOpeningId(null);
    setSaving(true);
    setError("");
    setReceiptError("");
    setNotice("");
    try {
      const result = await request<{ sale: SaleDetails }>("/sales", {
        method: "POST",
        body: JSON.stringify({ items: cart.map(line => ({ productId: line.productId, quantity: Number(line.quantity) })), notes: notes.trim() || undefined }),
      });
      setReceipt(result.sale);
      setSales(current => [result.sale, ...current]);
      setCart([]);
      setNotes("");
      setNotice("Sale recorded: " + result.sale.saleNumber);
    } catch (err) {
      setError(err instanceof ApiError && err.status > 0 && err.status < 500
        ? err.message : "Could not confirm the sale. Check transaction history before submitting again.");
    } finally {
      refresh();
      setSaving(false);
    }
  }

  async function openReceipt(id: number) {
    receiptRequest.current?.abort();
    const controller = new AbortController();
    receiptRequest.current = controller;
    setOpeningId(id);
    setReceiptError("");
    setReceipt(null);
    try {
      const detail = await request<SaleDetails>("/sales/" + id, { signal: controller.signal });
      if (!controller.signal.aborted) {
        revealReceipt.current = true;
        setReceipt(detail);
      }
    } catch (err) {
      if (!controller.signal.aborted) setReceiptError(err instanceof Error ? err.message : "Unable to open sale.");
    } finally {
      if (!controller.signal.aborted) setOpeningId(null);
    }
  }

  return <div className="space-y-5">
    <header className="flex items-center justify-between gap-3">
      <h2 className="text-2xl font-bold">Sales management</h2>
      <button className={button} disabled={loading || saving} onClick={refresh}>Refresh</button>
    </header>
    {loadError && <p role="alert" className="text-red-700">{loadError} Refresh to retry.</p>}
    {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{notice}</p>}
    <section className={panel}>
      <h3 className="mb-4 text-lg font-semibold">New sale</h3>
      <ProductPicker products={products.filter(p => p.isActive)} disabled={loading || saving || !!loadError} allowArchived={false} onSelect={add} />
      {lines.length > 0 && <fieldset disabled={saving} className="mt-4 space-y-3">
        {lines.map(line => <div key={line.productId} className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3">
          <div className="min-w-40 flex-1"><p className="font-medium">{line.product?.name ?? "Product #" + line.productId}</p>
            <p className="text-sm text-slate-600">{line.product?.sku} · {money.format(Number(line.product?.sellingPrice ?? 0))} each · {line.product?.stockQuantity ?? 0} available</p>
          </div>
          <label className="text-sm">Quantity<input type="number" min="1" step="1" value={line.quantity} aria-label={"Quantity for " + line.product?.sku}
            onChange={e => setCart(current => current.map(item => item.productId === line.productId ? { ...item, quantity: e.target.value } : item))}
            className="ml-2 w-20 rounded border border-slate-300 px-2 py-1" /></label>
          <span className="tabular-nums">{money.format(line.cents / 100)}</span>
          <button className={button} onClick={() => setCart(current => current.filter(item => item.productId !== line.productId))} aria-label={"Remove " + line.product?.sku}>Remove</button>
          {line.issue && <p role="alert" className="w-full text-sm text-red-700">{line.issue}</p>}
        </div>)}
      </fieldset>}
      <label className="mt-4 block text-sm">Notes (optional)<textarea disabled={saving} value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} rows={2}
        className="mt-1 block w-full rounded-lg border border-slate-300 p-2" /></label>
      {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4">
        <p>Total <strong className="ml-2 text-xl">{money.format(total / 100)}</strong></p>
        <button disabled={!canSubmit} onClick={checkout} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Recording…" : "Record sale"}
        </button>
      </div>
    </section>
    {receiptError && <p role="alert" className="text-red-700">{receiptError}</p>}
    {receipt && <section ref={receiptPanel} tabIndex={-1} className={panel + " scroll-mt-24"} aria-label="Sale details">
      <div className="flex items-center justify-between gap-3"><h3 className="break-all text-lg font-semibold">{receipt.saleNumber}</h3>
        <button className={button} onClick={() => setReceipt(null)}>Close details</button></div>
      <p className="mt-1 text-sm text-slate-600">{date.format(new Date(receipt.createdAt))} · {receipt.status} · User #{receipt.soldById}</p>
      <ul className="my-3 divide-y divide-slate-100">{receipt.items.map(item => <li key={item.productId} className="flex flex-wrap justify-between gap-2 py-2">
        <div>{byId.get(item.productId)?.name ?? "Product #" + item.productId} <span className="text-sm text-slate-600">({item.quantity} × {money.format(Number(item.unitPrice))})</span></div>
        <strong>{money.format(Number(item.lineTotal))}</strong></li>)}</ul>
      <p className="border-t border-slate-200 pt-2 font-semibold">Total {money.format(Number(receipt.total))}</p>
      {receipt.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{receipt.notes}</p>}
    </section>}
    <section className={panel}>
      <h3 className="mb-3 text-lg font-semibold">Transaction history</h3>
      {loading ? <p role="status">Loading transactions…</p> : !loadError && (sales.length === 0 ? <p>No sales recorded yet.</p> :
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr>{["Sale number", "Date", "Status", "Total"].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{sales.map(sale => <tr key={sale.id}>
            <td className="p-3"><button disabled={saving} onClick={() => openReceipt(sale.id)} className="text-blue-700 underline">{sale.saleNumber}</button>{openingId === sale.id && " …"}</td>
            <td className="whitespace-nowrap p-3">{date.format(new Date(sale.createdAt))}</td><td className="p-3">{sale.status}</td><td className="p-3">{money.format(Number(sale.total))}</td>
          </tr>)}</tbody>
        </table></div>)}
    </section>
  </div>;
}
