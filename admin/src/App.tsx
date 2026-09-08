import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAdmin } from './auth/RequireAdmin';
import { ToastProvider } from './components/Toast';
import { AdminLayout } from './layout/AdminLayout';
import { BannersPage } from './pages/BannersPage';
import { CatalogPage } from './pages/CatalogPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { OrderDetailPage, OrdersPage } from './pages/OrdersPage';
import { PartnersPage } from './pages/PartnersPage';
import { SearchPage } from './pages/SearchPage';
import { StoreDetailPage, StoresPage } from './pages/StoresPage';
import { TranslationsPage } from './pages/TranslationsPage';
import { UsersPage } from './pages/UsersPage';
import { ZonesPage } from './pages/ZonesPage';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAdmin />}>
              <Route element={<AdminLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="stores" element={<StoresPage />} />
                <Route path="stores/:id" element={<StoreDetailPage />} />
                <Route path="catalog" element={<CatalogPage />} />
                <Route path="banners" element={<BannersPage />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="orders/:id" element={<OrderDetailPage />} />
                <Route path="partners" element={<PartnersPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="zones" element={<ZonesPage />} />
                <Route path="translations" element={<TranslationsPage />} />
                <Route path="search" element={<SearchPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
