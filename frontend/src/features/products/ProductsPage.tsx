import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Package, RefreshCw, Search } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import type { Product } from "./product.types";
import type { Category } from "../categories/category.types";

const moneyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

export default function ProductsPage() {
  const { request } = useApi();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        const [productsResult, categoriesResult] = await Promise.all([
          request<Product[]>("/products", {
            signal: controller.signal,
          }),
          request<Category[]>("/categories", {
            signal: controller.signal,
          }),
        ]);

        if (!controller.signal.aborted) {
          if (
            !Array.isArray(productsResult) ||
            !Array.isArray(categoriesResult)
          ) {
            throw new Error("Unexpected response from the API.");
          }

          setProducts(productsResult);
          setCategories(categoriesResult);
          setError(null);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Unable to load products.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadProducts();

    return () => controller.abort();
  }, [request, reloadKey]);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        (categoryById
          .get(product.categoryId)
          ?.name.toLowerCase()
          .includes(term) ??
          false);

      const matchesCategory =
        selectedCategory === "all" ||
        String(product.categoryId) === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory, categoryById]);

  const lowStockCount = products.filter(
    (product) =>
      product.isActive && product.stockQuantity <= product.reorderLevel,
  ).length;

  function refresh() {
    setLoading(true);
    setError(null);
    setReloadKey((value) => value + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Product Management</h2>
          <p className="mt-1 text-sm text-slate-500">
            View products and monitor available inventory.
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total Products", value: products.length },
          {
            label: "Active Products",
            value: products.filter((product) => product.isActive).length,
          },
          { label: "Low Stock", value: lowStockCount },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-slate-500">{metric.label}</p>
            <p className="mt-2 text-3xl font-bold">{metric.value}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
          <div className="flex items-center gap-2">
            <Package size={20} className="text-blue-600" />
            <h3 className="font-semibold">Products</h3>
          </div>

          <select
              aria-label="Filter products by category"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 sm:w-56"
            >
              <option value="all">All categories</option>

              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                  {!category.isActive ? " (Inactive)" : ""}
                </option>
              ))}
            </select>

          <div className="relative w-full sm:w-72">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or SKU..."
              aria-label="Search products"
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <p role="status" className="p-10 text-center text-slate-500">
            Loading products...
          </p>
        ) : error ? (
          <div role="alert" className="p-10 text-center">
            <AlertCircle className="mx-auto mb-3 text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={refresh}
              className="mt-4 text-sm font-medium text-blue-600"
            >
              Try again
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="mx-auto mb-3 text-slate-400" size={32} />
            <p className="font-medium">
              {search ? "No matching products" : "No products yet"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {search
                ? "Try searching with another name or SKU."
                : "Products will appear here after they are created."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-4">
                    Product ID
                  </th>
                  <th scope="col" className="px-5 py-4">
                    Product
                  </th>
                  <th scope="col" className="px-5 py-4">
                    SKU
                  </th>
                  <th scope="col" className="px-5 py-4">
                    Category
                  </th>
                  <th scope="col" className="px-5 py-4">
                    Price
                  </th>
                  <th scope="col" className="px-5 py-4">
                    Stock
                  </th>
                  <th scope="col" className="px-5 py-4">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => {
                  const lowStock =
                    product.stockQuantity <= product.reorderLevel;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 font-medium">{product.id}</td>
                      <td className="px-5 py-4 font-medium">{product.name}</td>
                      <td className="px-5 py-4 text-slate-600">
                        {product.sku}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {categoryById.get(product.categoryId)?.name ??
                          `Category #${product.categoryId}`}
                      </td>
                      <td className="px-5 py-4">
                        {moneyFormatter.format(Number(product.sellingPrice))}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={
                            lowStock ? "font-semibold text-amber-700" : ""
                          }
                        >
                          {product.stockQuantity}
                        </span>
                        {lowStock && product.isActive && (
                          <span className="ml-2 text-xs text-amber-700">
                            Low
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            product.isActive
                              ? "bg-green-50 text-green-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {product.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
