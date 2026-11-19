import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  FolderOpen,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import type { Category } from './category.types';

type StatusFilter = 'all' | 'active' | 'inactive';

export default function CategoriesPage() {
  const { request } = useApi();

  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCategories() {
      setLoading(true);

      try {
        const result = await request<Category[]>('/categories', {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (!Array.isArray(result)) {
          throw new Error('Unexpected categories response.');
        }

        setCategories(result);
        setError(null);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load categories.',
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

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();

    return categories.filter((category) => {
      const matchesSearch =
        category.name.toLowerCase().includes(term) ||
        (category.description ?? '')
          .toLowerCase()
          .includes(term);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && category.isActive) ||
        (statusFilter === 'inactive' && !category.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [categories, search, statusFilter]);

  const activeCount = categories.filter(
    (category) => category.isActive,
  ).length;

  const inactiveCount = categories.length - activeCount;

  function refresh() {
    setLoading(true);
    setError(null);
    setReloadKey((value) => value + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Categories Management
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Organize and review your inventory categories.
          </p>
        </div>

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

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Total Categories', value: categories.length },
          { label: 'Active Categories', value: activeCount },
          { label: 'Inactive Categories', value: inactiveCount },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-slate-500">
              {metric.label}
            </p>
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
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                className="w-full rounded-lg border border-slate-200 py-2.5 pr-3 pl-10 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <p
            role="status"
            className="p-10 text-center text-slate-500"
          >
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
            <FolderOpen
              className="mx-auto mb-3 text-slate-400"
              size={32}
            />
            <p className="font-medium text-slate-900">
              {categories.length === 0
                ? 'No categories yet'
                : 'No matching categories'}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {categories.length === 0
                ? 'Categories will appear here once created.'
                : 'Try changing your search or status filter.'}
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
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredCategories.map((category) => (
                  <tr
                    key={category.id}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-5 py-4 text-slate-600">
                      {category.id}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {category.name}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {category.description || '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          category.isActive
                            ? 'bg-green-50 text-green-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {category.isActive
                          ? 'Active'
                          : 'Inactive'}
                      </span>
                    </td>
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
