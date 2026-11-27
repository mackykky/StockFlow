import { movementLabels, type MovementType } from "./movementTypes";
import ProductPicker from "./ProductPicker";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { hasPermission } from "../auth/permissions";
import { useAuth } from "../auth/useAuth";
import { useApi, ApiError } from "../../hooks/useApi";
import type { Product } from "../products/product.types";

type ManualType = Exclude<MovementType, "SALE">;

interface Movement {
  id: number;
  productId: number;
  type: MovementType;
  quantity: number;
  quantityAfter: number;
  createdAt: string;
  notes: string | null;
  userId: number;
}

function outbound(type: MovementType) {
  return type === "RETURN_OUT" || type === "ADJUSTMENT_OUT" || type === "SALE";
}

const field = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const panel = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function InventoryPage() {
  const { user } = useAuth();
  const { request } = useApi();
  const canManage = hasPermission(user?.role, "inventory:manage");
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [type, setType] = useState<ManualType>("PURCHASE");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    Promise.all([request<Product[]>("/products", options), request<Movement[]>("/stock-movements", options)])
      .then(([items, history]) => {
        if (controller.signal.aborted) return;
        setProducts(items);
        setMovements(history);
        setLoadError("");
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setLoadError(err instanceof Error ? err.message : "Unable to load inventory.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [request, revision]);

  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const product = byId.get(Number(selectedId));
  const history = selectedId ? movements.filter(m => m.productId === Number(selectedId)) : movements;
  const units = Number(quantity);
  const signedUnits = outbound(type) ? -units : units;

  function refresh() {
    setLoading(true);
    setRevision(value => value + 1);
  }

  async function record(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !product || (!product.isActive && !(product.isSuspended && outbound(type))) || saving || loading || loadError) return;
    setNotice("");
    setError("");
    if (!Number.isSafeInteger(units) || units < 1) {
      setError("Enter a positive whole number.");
      return;
    }
    if (outbound(type) && units > product.stockQuantity) {
      setError(`Insufficient stock. Only ${product.stockQuantity} units are available.`);
      return;
    }
    if (type === "OPENING_STOCK" && product.stockQuantity !== 0) {
      setError("Opening stock requires a zero balance.");
      return;
    }
    setSaving(true);
    try {
      const { movement } = await request<{ movement: Movement }>("/stock-movements", {
        method: "POST",
        body: JSON.stringify({ productId: product.id, type, quantity: units, notes: notes.trim() || undefined }),
      });
      setMovements(current => [movement, ...current]);
      setProducts(current => current.map(p => p.id === product.id ? { ...p, stockQuantity: movement.quantityAfter } : p));
      setNotice(`${movementLabels[type]} recorded for ${product.sku}. New balance: ${movement.quantityAfter}.`);
      setQuantity("");
      setNotes("");
      setType(product.isSuspended ? "ADJUSTMENT_OUT" : "PURCHASE");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError("Movement rejected. Review the refreshed product status and balance.");
      } else if (err instanceof ApiError && (err.status === 0 || err.status >= 500)) {
        setError("Could not confirm the movement. Check the refreshed history before submitting again.");
      } else {
        setError(err instanceof Error ? err.message : "Unable to record movement.");
      }
      refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Stock management</h2>
        <button type="button" onClick={refresh} disabled={loading || saving} className="rounded-lg border bg-white px-4 py-2">Refresh</button>
      </div>
      {loadError && <p role="alert" className="text-red-700">{loadError}</p>}
      <section className={panel}>
        <ProductPicker products={products} selected={product} disabled={loading || saving}
          onSelect={id => {
            setSelectedId(id);
            setQuantity(""); setNotes(""); setType(byId.get(Number(id))?.isSuspended ? "ADJUSTMENT_OUT" : "PURCHASE"); setNotice(""); setError("");
          }}
        />
        {product && <p className="mt-3">On hand <strong>{product.stockQuantity}</strong> · Reorder level {product.reorderLevel}</p>}
        {canManage && !product && <p className="mt-3 text-sm text-slate-600">Select a product to record a movement.</p>}
        {canManage && product && !product.isActive && !product.isSuspended && <p className="mt-3 text-sm text-slate-600">This product is archived. Its movement history is available below.</p>}
      </section>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {notice && <p role="status" className="text-green-800">{notice}</p>}
      {product?.isSuspended && <p className="text-sm text-slate-600">Inactive product. Only adjustments out and returns out are available.</p>}
      {canManage && product && (product.isActive || product.isSuspended) && (
        <form onSubmit={record} className={panel}>
          <h3 className="mb-4 text-lg font-semibold">Record stock movement</h3>
          <fieldset disabled={loading || saving || !!loadError} className="grid gap-4 sm:grid-cols-2">
            <label>Movement type
              <select id="movement-type" value={type} onChange={e => setType(e.target.value as ManualType)} className={field}>
                {product.isActive && <optgroup label="Stock in">
                  <option value="PURCHASE">Purchase</option>
                  <option value="OPENING_STOCK" disabled={product.stockQuantity !== 0}>Opening stock</option>
                  <option value="ADJUSTMENT_IN">Adjustment in</option>
                  <option value="RETURN_IN">Return in</option>
                </optgroup>}
                <optgroup label="Stock out">
                  <option value="ADJUSTMENT_OUT">Adjustment out</option>
                  <option value="RETURN_OUT">Return out</option>
                </optgroup>
              </select>
            </label>
            <label>Quantity<input id="movement-quantity" required type="number" min="1" step="1" className={field} value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
            <label className="sm:col-span-2">Notes (optional)<textarea id="movement-notes" maxLength={500} rows={2} className={field} value={notes} onChange={e => setNotes(e.target.value)} /></label>
            <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
              <button className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50" type="submit">{saving ? "Recording…" : "Record movement"}</button>
              {Number.isSafeInteger(units) && units > 0 && product.stockQuantity + signedUnits >= 0 &&
                <span className="text-sm text-slate-600">Expected balance: {product.stockQuantity + signedUnits}</span>}
            </div>
          </fieldset>
        </form>
      )}
      <section className={panel}>
        <h3 className="mb-4 text-lg font-semibold">Movement history</h3>
        {loading ? <p role="status">Loading inventory…</p> : loadError ? <p>Refresh to retry.</p> : history.length === 0 ? <p>No movements recorded.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600"><tr>
                {["Date", "Product", "Type", "Change", "Balance after", "User ID", "Notes"].map(label => <th key={label} scope="col" className="whitespace-nowrap p-3">{label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {history.map(m => {
                  const item = byId.get(m.productId);
                  return <tr key={m.id}>
                    <td className="whitespace-nowrap p-3">{dateFormat.format(new Date(m.createdAt))}</td>
                    <td className="p-3">{item ? <>{item.name}<small className="block text-slate-500">{item.sku}</small></> : m.productId}</td>
                    <td className="p-3">{movementLabels[m.type]}</td>
                    <td className="p-3">{outbound(m.type) ? "−" : "+"}{m.quantity}</td>
                    <td className="p-3">{m.quantityAfter}</td><td className="p-3">{m.userId}</td>
                    <td className="min-w-32 break-words p-3">{m.notes || "—"}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
