
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShoppingCart,
  Warehouse,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../features/auth/useAuth';

const navigation = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Products', path: '/products', icon: Package },
  { label: 'Categories', path: '/categories', icon: Boxes },
  { label: 'Inventory', path: '/inventory', icon: Warehouse },
  { label: 'Sales', path: '/sales', icon: ShoppingCart },
  { label: 'Reports', path: '/reports', icon: BarChart3 },
];

export default function AppLayout() {
  const navigate = useNavigate();
const { user, signOut } = useAuth();

function handleLogout() {
  signOut();
  setSidebarOpen(false);
  navigate('/login', { replace: true });
}
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const currentPage =
    navigation.find(({ path }) => location.pathname === path)?.label ??
    'StockFlow';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-600 p-2 text-white">
              <Boxes size={22} />
            </div>
            <span className="text-xl font-bold tracking-tight">
              StockFlow
            </span>
          </div>

          <button
            type="button"
            aria-label="Close sidebar"
            className="rounded-lg p-1 text-slate-500 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-4" aria-label="Main navigation">
          {navigation.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mb-3 rounded-lg bg-slate-50 px-4 py-3">
  <p className="text-sm font-semibold text-slate-900">
    {user
      ? `${user.firstName} ${user.lastName}`.trim() || user.email
      : 'User'}
  </p>

  <p className="text-xs text-slate-500">
    {user?.role}
  </p>
</div>

          
<button
  type="button"
  onClick={handleLogout}
  className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
>
  <LogOut size={19} />
  Logout
</button>

      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Open navigation"
              className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>

            <div>
              <h1 className="text-xl font-semibold">
                {currentPage}
              </h1>
              <p className="text-xs text-slate-500">
                Inventory Management System
              </p>
            </div>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
            SF
          </div>
        </header>

        <main className="mx-auto max-w-7xl p-5 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
