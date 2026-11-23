import { useEffect, useRef, useState } from "react";
import { ApiError, useApi } from "../../hooks/useApi";
import type { Category } from "../categories/category.types";
import { productStatus, type Product } from "./product.types";

type Action = "Activate" | "Deactivate" | "Archive" | "Restore";

interface Props {
  id: number;
  categoryById: ReadonlyMap<number, Category>;
  canChangeStatus: boolean;
  onClose: () => void;
  onStatusChanged: (updated: Product) => void;
}

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export default function ProductDetails({ id, categoryById, canChangeStatus, onClose, onStatusChanged }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { request } = useApi();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<Action | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const controller = new AbortController();
    request<Product>(`/products/${id}`, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setProduct(result);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Unable to load product.");
        }
      });
    return () => {
      controller.abort();
      element?.close();
    };
  }, [id, request]);

  async function changeStatus() {
    if (!product || !canChangeStatus || !confirming || saving) return;
    setSaving(true);
    setError("");
    try {
      const action = confirming.toLowerCase();
      const updated = await request<Product>(`/products/${id}/${action}`, { method: "PATCH" });
      setProduct(updated);
      onStatusChanged(updated);
      setConfirming(null);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400
        ? "The product status may have changed. Close details and refresh the list."
        : err instanceof Error ? err.message : "Unable to change product status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="product-details-title"
      onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}
      className="fixed inset-0 m-auto max-h-[90vh] w-11/12 max-w-lg overflow-y-auto rounded-xl p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/50">
      <div className="flex items-center justify-between gap-3">
        <h2 id="product-details-title" className="text-xl font-bold">Product details</h2>
        <button type="button" onClick={onClose} disabled={saving} className="rounded border px-3 py-1">Close</button>
      </div>
      {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
      {!product && !error && <p role="status" className="mt-4">Loading product…</p>}
      {product && (
        <>
          <h3 className="mt-5 break-words text-lg font-semibold">{product.name}</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-slate-600">{product.description || "No description"}</p>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            {Object.entries({
              SKU: product.sku,
              Category: categoryById.get(product.categoryId)?.name ?? String(product.categoryId),
              "Cost price": currency.format(Number(product.costPrice)),
              "Selling price": currency.format(Number(product.sellingPrice)),
              Stock: product.stockQuantity,
              "Reorder level": product.reorderLevel,
              Status: productStatus(product),
            }).map(([label, value]) => (
              <div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="break-words font-medium">{value}</dd></div>
            ))}
          </dl>
          {canChangeStatus && (
            <div className="mt-6 border-t border-slate-200 pt-4">
              {confirming ? (
                <>
                  <p>{confirming} {product.name} ({product.sku})?</p>
                  {confirming === "Restore" && <p className="text-sm text-slate-600">Restores as inactive. Activate separately to allow sales.</p>}
                  <div className="mt-3 flex gap-3">
                    <button type="button" disabled={saving} onClick={() => setConfirming(null)} className="rounded border px-3 py-2">Cancel</button>
                    <button type="button" disabled={saving} onClick={changeStatus} className="rounded bg-blue-700 px-3 py-2 text-white">
                      {saving ? "Saving..." : "Confirm " + confirming.toLowerCase()}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  {productStatus(product) === "Archived" ? (
                    <button type="button" className="rounded border px-3 py-2" onClick={() => setConfirming("Restore")}>Restore product</button>
                  ) : (
                    <>
                      <button type="button" className="rounded border px-3 py-2 disabled:opacity-50"
                        disabled={!product.isActive && !categoryById.get(product.categoryId)?.isActive}
                        onClick={() => setConfirming(product.isActive ? "Deactivate" : "Activate")}>
                        {product.isActive ? "Deactivate product" : "Activate product"}
                      </button>
                      <button type="button" className="rounded border px-3 py-2 disabled:opacity-50"
                        disabled={product.stockQuantity !== 0} onClick={() => setConfirming("Archive")}>Archive product</button>
                      {product.stockQuantity !== 0 && <p className="text-sm text-slate-600">Archiving requires zero stock.</p>}
                      {!product.isActive && !categoryById.get(product.categoryId)?.isActive && <p>Assign an active category before activation.</p>}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </dialog>
  );
}
