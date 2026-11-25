
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import AppLayout from './components/layout/AppLayout';
import ModulePlaceholder from './components/ui/ModulePlaceholder';
import AuthProvider from './features/auth/AuthProvider';
import LoginPage from './features/auth/LoginPage';
import ProtectedRoute from './routes/ProtectedRoute';
import SalesPage from './features/sales/SalesPage';
import InventoryPage from './features/inventory/InventoryPage';
import ProductsPage from './features/products/ProductsPage';
import CategoriesPage from './features/categories/CategoriesPage';

const modules = [
  {
    path: 'dashboard',
    title: 'Dashboard',
    description: 'Sales summaries, inventory metrics, and low-stock alerts.',
  },
  {
    path: 'reports',
    title: 'Reports',
    description: 'Review inventory and sales reports, including available exports.',
  },
];


function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="sales" element={<SalesPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="categories" element={<CategoriesPage />} />

              {modules.map(({ path, title, description }) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <ModulePlaceholder
                      title={title}
                      description={description}
                    />
                  }
                />
              ))}
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}


export default App;
