import { useState } from "react";
import { productStatus, type Product } from "../products/product.types";

interface Props {
  products: Product[];
  selected?: Product;
  allowArchived?: boolean;
  disabled: boolean;
  onSelect: (id: string) => void;
}

function label(product: Product) {
  return product.name + " · " + product.sku + (product.isActive ? "" : " (" + productStatus(product).toLowerCase() + ")");
}

export default function ProductPicker({ products, selected, disabled, onSelect, allowArchived = true }: Props) {
  const [includeArchived, setIncludeArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const term = query.trim().toLowerCase();
  const matches = products.filter(product =>
    (includeArchived || productStatus(product) !== "Archived") && (product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term))
  );
  const options = matches.slice(0, 30);
  const expanded = open && !disabled;
  const activeIndex = Math.min(index, options.length - 1);

  function choose(product?: Product) {
    if (product?.id !== selected?.id) onSelect(product ? String(product.id) : "");
    setOpen(false);
    setQuery("");
    setIndex(0);
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-3">
      <label htmlFor="inventory-product" className="font-semibold">Product</label>
      {allowArchived && <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={disabled} checked={includeArchived} onChange={e => {
        setIncludeArchived(e.target.checked);
        if (!e.target.checked && selected && productStatus(selected) === "Archived") choose();
      }} />Include archived</label>}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <input id="inventory-product" role="combobox" aria-autocomplete="list" autoComplete="off"
          aria-expanded={expanded} aria-controls={expanded ? "inventory-matches" : undefined}
          aria-activedescendant={expanded && activeIndex >= 0 ? "inventory-option-" + options[activeIndex].id : undefined}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search by product name or SKU" disabled={disabled}
          value={expanded ? query : selected ? label(selected) : ""}
          onFocus={() => { setQuery(""); setIndex(0); setOpen(true); }}
          onClick={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onChange={event => { setQuery(event.target.value); setIndex(0); setOpen(true); }}
          onKeyDown={event => {
            if (event.key === "Escape") {
              setOpen(false);
              setQuery("");
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              const step = event.key === "ArrowDown" ? 1 : -1;
              setIndex(expanded ? Math.max(0, Math.min(activeIndex + step, options.length - 1)) : 0);
            } else if (event.key === "Enter" && expanded && options[activeIndex]) {
              event.preventDefault();
              choose(options[activeIndex]);
            }
          }}
        />
        {selected && <button type="button" disabled={disabled} onClick={() => choose()}
          className="rounded-lg border px-3 py-2 text-sm">All products</button>}
      </div>
      {expanded && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          <ul id="inventory-matches" role="listbox" aria-label="Matching products" className="max-h-64 overflow-y-auto">
            {options.map((product, i) => (
              <li key={product.id} id={"inventory-option-" + product.id} role="option"
                aria-selected={i === activeIndex}
                ref={el => { if (el && i === activeIndex && document.activeElement?.id === "inventory-product") {
                  const list = el.parentElement;
                  if (list && (el.offsetTop < list.scrollTop || el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight))
                    list.scrollTop = el.offsetTop;
                } }}
                onMouseDown={event => event.preventDefault()} onClick={() => choose(product)}
                className={"cursor-pointer px-3 py-2 text-sm hover:bg-blue-50 " + (i === activeIndex ? "bg-blue-50" : "")}>
                {label(product)}
              </li>
            ))}
          </ul>
          {!options.length && <p role="status" className="p-3 text-sm text-slate-600">No matching products.</p>}
          {matches.length > options.length && <p className="border-t p-2 text-xs text-slate-600">Showing 30 matches. Type more to narrow the list.</p>}
        </div>
      )}
    </div>
  );
}
