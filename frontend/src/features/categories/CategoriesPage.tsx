import { useEffect, useMemo, useState, useRef } from "react";
import {
  AlertCircle,
  FolderOpen,
  Archive,
  Plus,
  RefreshCw,
  RotateCcw,
  X,
  Search,
  Pencil,
} from "lucide-react";
import { useApi, ApiError } from "../../hooks/useApi";
import type { Category } from "./category.types";
import { useAuth } from "../auth/useAuth";

type StatusFilter = "all" | "active" | "inactive";

export default function CategoriesPage() {
  const { request } = useApi();
  const { user } = useAuth();

  const canManageCategories =
    user?.role === "ADMIN" || user?.role === "MANAGER";
  const canDeactivateCategories = user?.role === "ADMIN";

  const [showAddForm, setShowAddForm] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const editFormRef = useRef<HTMLElement | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmationCategory, setConfirmationCategory] =
    useState<Category | null>(null);

  const [statusChangingId, setStatusChangingId] = useState<number | null>(null);

  const [statusError, setStatusError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCategories() {
      setLoading(true);

      try {
        const result = await request<Category[]>("/categories", {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (!Array.isArray(result)) {
          throw new Error("Unexpected categories response.");
        }

        setCategories(result);
        setError(null);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Unable to load categories.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadCategories();

    return () => controller.abort();
  }, [request, reloadKey]);

  useEffect(() => {
    if (!editingCategory) return;

    editFormRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [editingCategory]);

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();

    return categories.filter((category) => {
      const matchesSearch =
        category.name.toLowerCase().includes(term) ||
        (category.description ?? "").toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && category.isActive) ||
        (statusFilter === "inactive" && !category.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [categories, search, statusFilter]);

  const activeCount = categories.filter((category) => category.isActive).length;

  const inactiveCount = categories.length - activeCount;

  async function createCategory() {
    const name = categoryName.trim();
    const description = categoryDescription.trim();

    if (!name) {
      setFormError("Category name is required.");
      return;
    }

    if (!canManageCategories || saving) {
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      await request<Category>("/categories", {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
        }),
      });

      setCategoryName("");
      setCategoryDescription("");
      setShowAddForm(false);
      setReloadKey((value) => value + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError("A category with this name already exists.");
      } else {
        setFormError(
          err instanceof Error ? err.message : "Unable to create category.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  function startEditing(category: Category) {
    if (!canManageCategories || updating || saving) {
      return;
    }

    setShowAddForm(false);
    setFormError(null);

    setEditingCategory(category);
    setEditName(category.name);
    setEditDescription(category.description ?? "");
    setEditError(null);
  }

  function cancelEditing() {
    if (updating) return;

    setEditingCategory(null);
    setEditName("");
    setEditDescription("");
    setEditError(null);
  }

  async function updateCategory() {
    if (!canManageCategories || !editingCategory || updating) {
      return;
    }

    const name = editName.trim();
    const description = editDescription.trim();

    if (!name) {
      setEditError("Category name is required.");
      return;
    }

    setUpdating(true);
    setEditError(null);

    try {
      await request<Category>(`/categories/${editingCategory.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          description,
        }),
      });

      cancelEditingAfterSave();
      setReloadKey((value) => value + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setEditError("A category with this name already exists.");
      } else {
        setEditError(
          err instanceof Error ? err.message : "Unable to update category.",
        );
      }
    } finally {
      setUpdating(false);
    }
  }

  function cancelEditingAfterSave() {
    setEditingCategory(null);
    setEditName("");
    setEditDescription("");
    setEditError(null);
  }

  async function changeCategoryStatus() {
    if (
      !confirmationCategory ||
      !canDeactivateCategories ||
      statusChangingId !== null ||
      saving ||
      updating
    ) {
      return;
    }

    const category = confirmationCategory;
    const activating = !category.isActive;

    setStatusChangingId(category.id);
    setStatusError(null);

    try {
      await request<Category>(
        `/categories/${category.id}/${activating ? "activate" : "deactivate"}`,
        { method: "PATCH" },
      );

      if (editingCategory?.id === category.id) {
        setEditingCategory(null);
      }

      setConfirmationCategory(null);
      setReloadKey((value) => value + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setStatusError(
          "The category status has already changed. Please refresh the page.",
        );
      } else if (err instanceof ApiError && err.status === 403) {
        setStatusError("You do not have permission to change category status.");
      } else {
        setStatusError(
          err instanceof Error
            ? err.message
            : "Unable to change category status.",
        );
      }

      setConfirmationCategory(null);
    } finally {
      setStatusChangingId(null);
    }
  }

  function refresh() {
    setLoading(true);
    setError(null);
    setReloadKey((value) => value + 1);
  }

  return (
    <div className="space-y-6">
      {canDeactivateCategories && confirmationCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="category-status-title"
            aria-describedby="category-status-description"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div
                className={`rounded-xl p-3 ${
                  confirmationCategory.isActive
                    ? "bg-red-50 text-red-600"
                    : "bg-green-50 text-green-700"
                }`}
              >
                {confirmationCategory.isActive ? (
                  <Archive size={24} />
                ) : (
                  <RotateCcw size={24} />
                )}
              </div>

              <button
                type="button"
                aria-label="Close confirmation"
                disabled={statusChangingId !== null}
                onClick={() => setConfirmationCategory(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <h2
              id="category-status-title"
              className="mt-5 text-xl font-semibold text-slate-900"
            >
              {confirmationCategory.isActive
                ? "Deactivate category?"
                : "Activate category?"}
            </h2>

            <p
              id="category-status-description"
              className="mt-3 text-sm leading-6 text-slate-600"
            >
              Are you sure you want to{" "}
              {confirmationCategory.isActive ? "deactivate" : "activate"}{" "}
              <span className="font-semibold text-slate-900">
                {confirmationCategory.name}
              </span>
              ?
            </p>

            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              {confirmationCategory.isActive
                ? "The category will become inactive. Existing products will remain assigned to it, and you can reactivate it later."
                : "The category will become active again and can be used when assigning categories to new products."}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={statusChangingId !== null}
                onClick={() => setConfirmationCategory(null)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={statusChangingId !== null}
                onClick={() => void changeCategoryStatus()}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${
                  confirmationCategory.isActive
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {statusChangingId !== null
                  ? "Processing..."
                  : confirmationCategory.isActive
                    ? "Deactivate Category"
                    : "Activate Category"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Categories Management
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Organize and review your inventory categories.
          </p>
        </div>
        {canManageCategories && (
          <button
            type="button"
            onClick={() => {
              if (updating) return;

              cancelEditing();
              setFormError(null);
              setShowAddForm(true);
            }}
            disabled={updating || saving || statusChangingId !== null}

            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Add Category
          </button>
        )}
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {canManageCategories && showAddForm && (
        <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">
            Add New Category
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Create a category to organize your inventory products.
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void createCategory();
            }}
            className="mt-5 space-y-4"
          >
            <div>
              <label
                htmlFor="new-category-name"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Category Name
              </label>

              <input
                id="new-category-name"
                type="text"
                required
                maxLength={100}
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="Enter category name"
                disabled={saving}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="new-category-description"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Description (Optional)
              </label>

              <textarea
                id="new-category-description"
                rows={3}
                value={categoryDescription}
                onChange={(event) => setCategoryDescription(event.target.value)}
                placeholder="Describe this category"
                disabled={saving}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-60"
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
                disabled={
                  saving || statusChangingId !== null || !categoryName.trim()
                }
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Category"}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setShowAddForm(false);
                  setCategoryName("");
                  setCategoryDescription("");
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

      {canManageCategories && editingCategory && (
        <section
          ref={editFormRef}
          className="scroll-mt-24 rounded-xl border border-blue-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Pencil size={18} className="text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-900">
              Edit Category
            </h3>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Update category #{editingCategory.id}.
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void updateCategory();
            }}
            className="mt-5 space-y-4"
          >
            <div>
              <label
                htmlFor="edit-category-name"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Category Name
              </label>

              <input
                id="edit-category-name"
                type="text"
                required
                maxLength={100}
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                disabled={updating}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="edit-category-description"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Description (Optional)
              </label>

              <textarea
                id="edit-category-description"
                rows={3}
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                disabled={updating}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-60"
              />
            </div>

            {editError && (
              <p role="alert" className="text-sm text-red-600">
                {editError}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={
                  updating || statusChangingId !== null || !editName.trim()
                }
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

      {statusError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{statusError}</span>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total Categories", value: categories.length },
          { label: "Active Categories", value: activeCount },
          { label: "Inactive Categories", value: inactiveCount },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-slate-500">{metric.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
          <div className="flex items-center gap-2">
            <FolderOpen size={20} className="text-blue-600" />
            <h3 className="font-semibold">Categories</h3>
          </div>

          <div className="flex w-full flex-wrap gap-3 sm:w-auto">
            <select
              aria-label="Filter categories by status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                aria-label="Search categories"
                placeholder="Search categories..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-lg border border-slate-200 py-2.5 pr-3 pl-10 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <p role="status" className="p-10 text-center text-slate-500">
            Loading categories...
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
        ) : filteredCategories.length === 0 ? (
          <div className="p-12 text-center">
            <FolderOpen className="mx-auto mb-3 text-slate-400" size={32} />
            <p className="font-medium text-slate-900">
              {categories.length === 0
                ? "No categories yet"
                : "No matching categories"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {categories.length === 0
                ? "Categories will appear here once created."
                : "Try changing your search or status filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-4">
                    Category ID
                  </th>
                  <th scope="col" className="px-5 py-4">
                    Name
                  </th>
                  <th scope="col" className="px-5 py-4">
                    Description
                  </th>
                  <th scope="col" className="px-5 py-4">
                    Status
                  </th>
                  {canManageCategories && (
                    <th scope="col" className="px-5 py-4">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredCategories.map((category) => (
                  <tr key={category.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 text-slate-600">{category.id}</td>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {category.name}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {category.description || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          category.isActive
                            ? "bg-green-50 text-green-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {category.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {canManageCategories && (
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(category)}
                            disabled={
                              updating || saving || statusChangingId !== null
                            }
                            aria-label={`Edit ${category.name}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                          >
                            <Pencil size={15} />
                            Edit
                          </button>

                          {canDeactivateCategories && (
                            <button
                              type="button"
                              onClick={() => {
                                setStatusError(null);
                                setConfirmationCategory(category);
                              }}
                              disabled={
                                statusChangingId !== null || updating || saving
                              }
                              aria-label={`${category.isActive ? "Deactivate" : "Activate"} ${category.name}`}
                              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                                category.isActive
                                  ? "border-red-200 text-red-600 hover:bg-red-50"
                                  : "border-green-200 text-green-700 hover:bg-green-50"
                              }`}
                            >
                              {category.isActive ? (
                                <>
                                  <Archive size={15} />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <RotateCcw size={15} />
                                  Activate
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
