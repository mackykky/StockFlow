import { useSearchParams } from "react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { AlertCircle, Package, Plus, RefreshCw, Search, Pencil } from "lucide-react";
import { useApi, ApiError } from "../../hooks/useApi";
import { useAuth } from "../auth/useAuth";
import { productStatus, type Product } from "./product.types";
import ProductDetails from "./ProductDetails";
import type { Category } from "../categories/category.types";

const moneyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

export default function ProductsPage() {
  const { request } = useApi();
  const { user } = useAuth();

  const canManageProducts =
  user?.role === "ADMIN" || user?.role === "MANAGER";

  const [showAddForm, setShowAddForm] = useState(false);
  const [productName, setProductName] = useState("");
  const [productSku, setProductSku] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productCategoryId, setProductCategoryId] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [reorderLevel, setReorderLevel] = useState("0");  
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const editFormRef = useRef<HTMLElement | null>(null);
  const [editName, setEditName] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editSellingPrice, setEditSellingPrice] = useState("");
  const [editReorderLevel, setEditReorderLevel] = useState("0");

  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [params] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState(params.get("category") ?? "all");
  const [status, setStatus] = useState("active");
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

    useEffect(() => {
  if (!editingProduct) return;

  editFormRef.current?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}, [editingProduct]);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  useEffect(() => {
  if (!editingProduct) return;

  editFormRef.current?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}, [editingProduct]);

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

      return matchesSearch && matchesCategory && (status === "all" || productStatus(product).toLowerCase() === status);
    });
  }, [products, search, selectedCategory, categoryById, status]);

  const lowStockCount = products.filter(
    (product) =>
      product.isActive && product.stockQuantity <= product.reorderLevel,
  ).length;


async function createProduct() {
  if (!canManageProducts || saving || updating) return;

  const name = productName.trim();
  const sku = productSku.trim();
  const description = productDescription.trim();

  if (!name || !sku || !productCategoryId) {
    setFormError("Product name, SKU, and category are required.");
    return;
  }

  if (name.length > 150 || sku.length > 50 || description.length > 1000) {
    setFormError("One or more fields exceed the allowed character limit.");
    return;
  }

  const categoryId = Number(productCategoryId);
  const cost = Number(costPrice);
  const selling = Number(sellingPrice);
  const reorder = Number(reorderLevel);

  if (!Number.isInteger(categoryId) || categoryId < 1) {
    setFormError("Please select a valid category.");
    return;
  }

  if (!categories.some((category) => category.id === categoryId && category.isActive)) {
    setFormError("Please select an active category.");
    return;
  }

  if (
    costPrice.trim() === "" ||
    sellingPrice.trim() === "" ||
    !Number.isFinite(cost) ||
    !Number.isFinite(selling) ||
    cost < 0 ||
    selling < 0 ||
    !/^\d+(\.\d{1,2})?$/.test(costPrice.trim()) ||
    !/^\d+(\.\d{1,2})?$/.test(sellingPrice.trim())
  ) {
    setFormError("Enter valid nonnegative prices with at most two decimal places.");
    return;
  }

  if (
    reorderLevel.trim() === "" ||
    !Number.isInteger(reorder) ||
    reorder < 0
  ) {
    setFormError("Reorder level must be a nonnegative whole number.");
    return;
  }

  setSaving(true);
  setFormError(null);

  try {
    await request<Product>("/products", {
      method: "POST",
      body: JSON.stringify({
        name,
        sku,
        description,
        categoryId,
        costPrice: cost,
        sellingPrice: selling,
        reorderLevel: reorder,
      }),
    });

    setProductName("");
    setProductSku("");
    setProductDescription("");
    setProductCategoryId("");
    setCostPrice("");
    setSellingPrice("");
    setReorderLevel("0");
    setShowAddForm(false);

    setLoading(true);
    setReloadKey((value) => value + 1);
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      setFormError("A product with this SKU already exists.");
    } else {
      setFormError(
        err instanceof Error ? err.message : "Unable to create product.",
      );
    }
  } finally {
    setSaving(false);
  }
}


function startEditing(product: Product) {
  if (!canManageProducts || saving || updating) {
    return;
  }

  // Close the Add Product form.
  setShowAddForm(false);
  setFormError(null);

  // Store the selected product.
  setEditingProduct(product);

  // Populate the edit fields with existing values.
  setEditName(product.name);
  setEditSku(product.sku);
  setEditDescription(product.description ?? "");
  setEditCategoryId(String(product.categoryId));
  setEditCostPrice(String(product.costPrice));
  setEditSellingPrice(String(product.sellingPrice));
  setEditReorderLevel(String(product.reorderLevel));

  setEditError(null);
}

function cancelEditing() {
  if (updating) return;

  setEditingProduct(null);
  setEditName("");
  setEditSku("");
  setEditDescription("");
  setEditCategoryId("");
  setEditCostPrice("");
  setEditSellingPrice("");
  setEditReorderLevel("0");
  setEditError(null);
}


async function updateProduct() {
  if (!canManageProducts || !editingProduct || updating || saving) {
    return;
  }

  const name = editName.trim();
  const sku = editSku.trim();
  const description = editDescription.trim();

  if (!name || !sku || !editCategoryId) {
    setEditError("Product name, SKU, and category are required.");
    return;
  }

  if (name.length > 150 || sku.length > 50 || description.length > 1000) {
    setEditError("One or more fields exceed the allowed character limit.");
    return;
  }

  const categoryId = Number(editCategoryId);
  const cost = Number(editCostPrice);
  const selling = Number(editSellingPrice);
  const reorder = Number(editReorderLevel);

  if (!Number.isInteger(categoryId) || categoryId < 1) {
    setEditError("Please select a valid category.");
    return;
  }

  const originalCategoryUnchanged =
    categoryId === editingProduct.categoryId;

  const selectedCategory = categories.find(
    (category) => category.id === categoryId,
  );

  if (
    !selectedCategory ||
    (!selectedCategory.isActive && !originalCategoryUnchanged)
  ) {
    setEditError(
      "Please select an active category, or keep the product's current category.",
    );
    return;
  }

  if (
    editCostPrice.trim() === "" ||
    editSellingPrice.trim() === "" ||
    !Number.isFinite(cost) ||
    !Number.isFinite(selling) ||
    cost < 0 ||
    selling < 0 ||
    !/^\d+(\.\d{1,2})?$/.test(editCostPrice.trim()) ||
    !/^\d+(\.\d{1,2})?$/.test(editSellingPrice.trim())
  ) {
    setEditError(
      "Enter valid nonnegative prices with at most two decimal places.",
    );
    return;
  }

  if (
    editReorderLevel.trim() === "" ||
    !Number.isInteger(reorder) ||
    reorder < 0
  ) {
    setEditError("Reorder level must be a nonnegative whole number.");
    return;
  }

  setUpdating(true);
  setEditError(null);

  try {
    await request<Product>(`/products/${editingProduct.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name,
        sku,
        description,
        ...(categoryId !== editingProduct.categoryId ? { categoryId } : {}),
        costPrice: cost,
        sellingPrice: selling,
        reorderLevel: reorder,
      }),
    });

    setEditingProduct(null);
    setEditName("");
    setEditSku("");
    setEditDescription("");
    setEditCategoryId("");
    setEditCostPrice("");
    setEditSellingPrice("");
    setEditReorderLevel("0");
    setEditError(null);

    setLoading(true);
    setReloadKey((value) => value + 1);
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      setEditError("A product with this SKU already exists.");
    } else {
      setEditError(
        err instanceof Error ? err.message : "Unable to update product.",
      );
    }
  } finally {
    setUpdating(false);
  }
}


  function refresh() {
    setLoading(true);
    setError(null);
    setReloadKey((value) => value + 1);
  }

  return (
    <div className="space-y-6">
      {detailId !== null && (
        <ProductDetails
          id={detailId}
          categoryById={categoryById}
          canChangeStatus={user?.role === "ADMIN"}
          onClose={() => setDetailId(null)}
          onStatusChanged={(updated) =>
            setProducts((current) => current.map((p) => p.id === updated.id ? updated : p))
          }
        />
      )}
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

      {canManageProducts && (
  <button
    type="button"
    onClick={() => {
      if (saving || updating) return;
      cancelEditing();
      setFormError(null);
      setShowAddForm(true);
    }}
    disabled={saving || updating}
    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
  >
    <Plus size={16} />
    Add Product
  </button>
)}


{canManageProducts && showAddForm && (
  <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
    <h3 className="text-lg font-semibold text-slate-900">
      Add New Product
    </h3>

    <p className="mt-1 text-sm text-slate-500">
      Enter product details to add a new item to your inventory.
    </p>

    <form
      onSubmit={(event) => {
        event.preventDefault();
        void createProduct();
      }}
      className="mt-5 space-y-4"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="product-name"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Product Name *
          </label>
          <input
            id="product-name"
            type="text"
            required
            maxLength={150}
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
            disabled={saving}
            placeholder="Enter product name"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="product-sku"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            SKU *
          </label>
          <input
            id="product-sku"
            type="text"
            required
            maxLength={50}
            value={productSku}
            onChange={(event) => setProductSku(event.target.value)}
            disabled={saving}
            placeholder="e.g. PROD-001"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="product-category"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Category *
          </label>
          <select
            id="product-category"
            required
            value={productCategoryId}
            onChange={(event) => setProductCategoryId(event.target.value)}
            disabled={saving}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">Select a category</option>

            {categories
              .filter((category) => category.isActive)
              .map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="product-reorder"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Reorder Level
          </label>
          <input
            id="product-reorder"
            type="number"
            min="0"
            step="1"
            required
            value={reorderLevel}
            onChange={(event) => setReorderLevel(event.target.value)}
            disabled={saving}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="product-cost"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Cost Price (PHP) *
          </label>
          <input
            id="product-cost"
            type="number"
            min="0"
            step="0.01"
            required
            value={costPrice}
            onChange={(event) => setCostPrice(event.target.value)}
            disabled={saving}
            placeholder="0.00"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="product-selling"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Selling Price (PHP) *
          </label>
          <input
            id="product-selling"
            type="number"
            min="0"
            step="0.01"
            required
            value={sellingPrice}
            onChange={(event) => setSellingPrice(event.target.value)}
            disabled={saving}
            placeholder="0.00"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="product-description"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Description (Optional)
        </label>
        <textarea
          id="product-description"
          rows={3}
          maxLength={1000}
          value={productDescription}
          onChange={(event) => setProductDescription(event.target.value)}
          disabled={saving}
          placeholder="Describe this product"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
        />
      </div>

      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving || updating || loading}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving Product..." : "Save Product"}
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setShowAddForm(false);
            setFormError(null);
          }}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  </section>
)}


{canManageProducts && editingProduct && (
  <section
    ref={editFormRef}
    className="scroll-mt-24 rounded-xl border border-blue-200 bg-white p-5 shadow-sm"
  >
    <div className="flex items-center gap-2">
      <Pencil size={18} className="text-blue-600" />
      <h3 className="text-lg font-semibold text-slate-900">
        Edit Product
      </h3>
    </div>

    <p className="mt-1 text-sm text-slate-500">
      Update product #{editingProduct.id}. Stock quantities are managed
      separately through inventory movements.
    </p>

    <form
      onSubmit={(event) => {
        event.preventDefault();
        void updateProduct();
      }}
      className="mt-5 space-y-4"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {/* Product Name */}
        <div>
          <label
            htmlFor="edit-product-name"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Product Name *
          </label>

          <input
            id="edit-product-name"
            type="text"
            required
            maxLength={150}
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            disabled={updating}
            placeholder="Enter product name"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>

        {/* SKU */}
        <div>
          <label
            htmlFor="edit-product-sku"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            SKU *
          </label>

          <input
            id="edit-product-sku"
            type="text"
            required
            maxLength={50}
            value={editSku}
            onChange={(event) => setEditSku(event.target.value)}
            disabled={updating}
            placeholder="Enter product SKU"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>

        {/* Category */}
        <div>
          <label
            htmlFor="edit-product-category"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Category *
          </label>

          <select
            id="edit-product-category"
            required
            value={editCategoryId}
            onChange={(event) => setEditCategoryId(event.target.value)}
            disabled={updating}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">Select a category</option>

            {categories
              .filter(
                (category) =>
                  category.isActive ||
                  category.id === editingProduct.categoryId,
              )
              .map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                  {!category.isActive ? " (Archived - Current)" : ""}
                </option>
              ))}
          </select>

          <p className="mt-1 text-xs text-slate-500">
            Only active categories can be assigned. An existing archived
            category may be retained.
          </p>
        </div>

        {/* Reorder Level */}
        <div>
          <label
            htmlFor="edit-product-reorder"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Reorder Level
          </label>

          <input
            id="edit-product-reorder"
            type="number"
            min="0"
            step="1"
            required
            value={editReorderLevel}
            onChange={(event) => setEditReorderLevel(event.target.value)}
            disabled={updating}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>

        {/* Cost Price */}
        <div>
          <label
            htmlFor="edit-product-cost"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Cost Price (PHP) *
          </label>

          <input
            id="edit-product-cost"
            type="number"
            min="0"
            step="0.01"
            required
            value={editCostPrice}
            onChange={(event) => setEditCostPrice(event.target.value)}
            disabled={updating}
            placeholder="0.00"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>

        {/* Selling Price */}
        <div>
          <label
            htmlFor="edit-product-selling"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Selling Price (PHP) *
          </label>

          <input
            id="edit-product-selling"
            type="number"
            min="0"
            step="0.01"
            required
            value={editSellingPrice}
            onChange={(event) => setEditSellingPrice(event.target.value)}
            disabled={updating}
            placeholder="0.00"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="edit-product-description"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Description (Optional)
        </label>

        <textarea
          id="edit-product-description"
          rows={3}
          maxLength={1000}
          value={editDescription}
          onChange={(event) => setEditDescription(event.target.value)}
          disabled={updating}
          placeholder="Describe this product"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
        />
      </div>

      {/* Validation and API errors */}
      {editError && (
        <p role="alert" className="text-sm text-red-600">
          {editError}
        </p>
      )}

      {/* Form actions */}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={updating || saving}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {updating ? "Saving Changes..." : "Save Changes"}
        </button>

        <button
          type="button"
          disabled={updating}
          onClick={cancelEditing}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  </section>
)}


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

          <select aria-label="Filter products by status" value={status} onChange={e => setStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
            <option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option><option value="all">All statuses</option>
          </select>
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
                  {!category.isActive ? " (Archived)" : ""}
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
              {products.length ? "No matching products" : "No products yet"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {products.length
                ? "Try a different search, category, or status."
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
                  {canManageProducts && (
  <th scope="col" className="px-5 py-4">
    Actions
  </th>
)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => {
                  const lowStock =
                    product.stockQuantity <= product.reorderLevel;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 font-medium">{product.id}</td>
                      <td className="px-5 py-4 font-medium">
                        <button
                          type="button"
                          aria-label={`View details for ${product.name}`}
                          className="text-left text-blue-700 underline underline-offset-2"
                          onClick={() => setDetailId(product.id)}
                        >
                          {product.name}
                        </button>
                      </td>
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
                          {productStatus(product)}
                        </span>
                      </td>
                      {canManageProducts && (
  <td className="px-5 py-4">
    <button
      type="button"
      onClick={() => startEditing(product)}
      disabled={saving || updating}
      aria-label={`Edit ${product.name}`}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Pencil size={15} />
      Edit
    </button>
  </td>
)}
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
