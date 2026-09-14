import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAdmin } from './auth/RequireAdmin';
import { ToastProvider } from './components/Toast';
import { AdminLayout } from './layout/AdminLayout';
import { BannersPage } from './pages/BannersPage';
import { BusinessAnalyticsPage } from './pages/BusinessAnalyticsPage';
import { HomeCollectionsPage } from './pages/HomeCollectionsPage';
import { CatalogPage } from './pages/CatalogPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { OrderDetailPage, OrdersPage } from './pages/OrdersPage';
import { ReturnDetailPage, ReturnsPage } from './pages/ReturnsPage';
import { PartnersPage } from './pages/PartnersPage';
import { PromotionsPage } from './pages/PromotionsPage';
import { OrderAlertsPage } from './pages/OrderAlertsPage';
import { SearchPage } from './pages/SearchPage';
import { StoreDetailPage, StoresPage } from './pages/StoresPage';
import { TranslationsPage } from './pages/TranslationsPage';
import {
  AnnouncementsPage,
  AppConfigPage,
  AuditLogsPage,
  ControlsPage,
  FeatureFlagsPage,
  MaintenancePage,
  SystemHealthPage,
  VersionsPage,
} from './pages/SystemPages';
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
                <Route path="promotions" element={<PromotionsPage />} />
                <Route path="order-alerts" element={<OrderAlertsPage />} />
                <Route path="home-collections" element={<HomeCollectionsPage />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="orders/:id" element={<OrderDetailPage />} />
                <Route path="business-analytics" element={<BusinessAnalyticsPage />} />
                <Route path="returns" element={<ReturnsPage />} />
                <Route path="returns/:id" element={<ReturnDetailPage />} />
                <Route path="partners" element={<PartnersPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="zones" element={<ZonesPage />} />
                <Route path="translations" element={<TranslationsPage />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="system/versions" element={<VersionsPage />} />
                <Route path="system/flags" element={<FeatureFlagsPage />} />
                <Route path="system/config" element={<AppConfigPage />} />
                <Route path="system/maintenance" element={<MaintenancePage />} />
                <Route path="system/controls" element={<ControlsPage />} />
                <Route path="system/announcements" element={<AnnouncementsPage />} />
                <Route path="system/audit" element={<AuditLogsPage />} />
                <Route path="system/health" element={<SystemHealthPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
