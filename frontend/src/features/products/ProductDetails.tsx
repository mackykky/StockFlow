import { AlertCircle, Archive, Boxes, FolderOpen, Package, Tags, X } from "lucide-react";
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

  const status = product && productStatus(product);
  const category = product && categoryById.get(product.categoryId);
  const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";
  const neutralButton = button + " border-slate-200 bg-white text-slate-700 hover:bg-slate-100";
  const dangerButton = button + " border-red-200 bg-red-50 text-red-700 enabled:hover:bg-red-100 focus-visible:outline-red-600";
  const positiveButton = button + " border-green-200 bg-white text-green-700 enabled:hover:bg-green-50";
  const dangerConfirmation = confirming === "Deactivate" || confirming === "Archive";

  return (
    <dialog ref={dialog} aria-labelledby="product-details-title"
      onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto overscroll-contain rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/55">
      <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <span className="rounded-lg bg-blue-50 p-2 text-blue-700"><Package size={18} aria-hidden="true" /></span> Product details
          </div>
          <button type="button" aria-label="Close" disabled={saving} onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-2">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <h2 id="product-details-title" className="mt-2 break-words text-2xl font-semibold tracking-tight sm:text-3xl">
          {product?.name ?? "Product details"}
        </h2>
        {product && status && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold " +
              ({ Active: "bg-green-100 text-green-800", Inactive: "bg-amber-100 text-amber-900", Archived: "bg-slate-200 text-slate-800" }[status])}>
              <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{status}
            </span>
            <span className="min-w-0 break-all font-mono text-slate-600">SKU {product.sku}</span>
            <span className="inline-flex min-w-0 items-center gap-1.5 text-slate-600">
              <FolderOpen size={15} className="shrink-0" aria-hidden="true" />
              <span className="sr-only">Category </span><span className="break-words">{category?.name ?? product.categoryId}</span>
            </span>
          </div>
        )}
      </header>

      {error && <p role="alert" className="mx-5 my-4 flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
        <AlertCircle size={18} className="shrink-0" aria-hidden="true" />{error}
      </p>}
      {!product && !error && <p role="status" className="p-6 text-slate-600">Loading product…</p>}
      {product && (
        <>
          <div className="space-y-5 p-5 sm:p-7">
            <div className="grid gap-3 sm:grid-cols-2">
              <section className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Boxes className="text-blue-600" size={17} aria-hidden="true" /> Inventory</h3>
                <dl className="mt-4 space-y-3">
                  <div><dt className="text-xs text-slate-600">Stock</dt><dd className="break-words text-3xl font-semibold tracking-tight tabular-nums">{product.stockQuantity} <span className="text-sm font-normal text-slate-600">units</span></dd></div>
                  <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-3 text-sm"><dt>Reorder level</dt><dd className="font-semibold tabular-nums">{product.reorderLevel}</dd></div>
                </dl>
                {product.isActive && product.stockQuantity <= product.reorderLevel && <p className="mt-2 text-xs font-semibold text-amber-800">{product.stockQuantity === 0 ? "Out of stock" : "At or below reorder level"}</p>}
              </section>
              <section className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Tags className="text-blue-600" size={17} aria-hidden="true" /> Pricing</h3>
                <dl className="mt-4 space-y-3">
                  <div><dt className="text-xs text-slate-600">Selling price</dt><dd className="break-words text-3xl font-semibold tracking-tight tabular-nums">{currency.format(Number(product.sellingPrice))}</dd></div>
                  <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-3 text-sm"><dt>Cost price</dt><dd className="break-all font-semibold tabular-nums">{currency.format(Number(product.costPrice))}</dd></div>
                </dl>
              </section>
            </div>
            {product.description && <section><h3 className="text-sm font-semibold">Description</h3><p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{product.description}</p></section>}
          </div>
          {canChangeStatus && (
            <footer className="border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-7">
              {confirming ? (
                <>
                  <p className="break-words font-semibold">{confirming} {product.name} ({product.sku})?</p>
                  {confirming === "Deactivate" && <p className="mt-1 text-sm text-slate-600">Sales and incoming stock will stop for this product.</p>}
                  {confirming === "Archive" && <p className="mt-1 text-sm text-slate-600">This product will move to Archived. Its history will remain available.</p>}
                  {confirming === "Restore" && <p className="mt-1 text-sm text-slate-600">Restores as inactive. Activate separately to allow sales.</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={saving} onClick={() => setConfirming(null)} className={neutralButton}>Cancel</button>
                    <button type="button" disabled={saving} onClick={changeStatus}
                      className={button + " border-transparent text-white " + (dangerConfirmation ? "bg-red-600 hover:bg-red-700" : "bg-green-700 hover:bg-green-800")}>
                      {saving ? "Saving…" : "Confirm " + confirming.toLowerCase()}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">Manage status</h3>
                    <div className="flex flex-wrap gap-2">
                      {status === "Archived" ? (
                        <button type="button" className={positiveButton} onClick={() => setConfirming("Restore")}>Restore product</button>
                      ) : (
                        <>
                          <button type="button" className={product.isActive ? dangerButton : positiveButton} disabled={!product.isActive && !category?.isActive}
                            onClick={() => setConfirming(product.isActive ? "Deactivate" : "Activate")}>
                            {product.isActive ? "Deactivate product" : "Activate product"}
                          </button>
                          <button type="button" className={dangerButton} disabled={product.stockQuantity !== 0} onClick={() => setConfirming("Archive")}>
                            <Archive size={15} aria-hidden="true" />Archive product
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {status !== "Archived" && product.stockQuantity !== 0 && <p className="mt-2 text-sm text-slate-600">Archiving requires zero stock.</p>}
                  {status === "Inactive" && !category?.isActive && <p className="mt-2 text-sm text-slate-600">Assign an active category before activation.</p>}
                </>
              )}
            </footer>
          )}
        </>
      )}
    </dialog>
  );
}