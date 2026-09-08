import { NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/stores', label: 'Stores' },
  { to: '/catalog', label: 'Catalog' },
  { to: '/banners', label: 'Banners' },
  { to: '/orders', label: 'Orders' },
  { to: '/partners', label: 'Partners' },
  { to: '/users', label: 'Users' },
  { to: '/zones', label: 'Zones' },
  { to: '/translations', label: 'Translations' },
  { to: '/search', label: 'Search' },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className={`admin-shell ${open ? 'nav-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src="/logo.png" alt="DayFax" />
          <span>Admin</span>
        </div>
        <nav>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <span>{user?.fullName || 'Admin'}</span>
            <small>{user?.email}</small>
          </div>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <div className="main-col">
        <header className="topbar">
          <button
            type="button"
            className="btn btn-ghost menu-btn"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            Menu
          </button>
          <p className="topbar-hint">Operations console</p>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
      {open ? <button type="button" className="nav-backdrop" onClick={() => setOpen(false)} aria-label="Close menu" /> : null}
    </div>
  );
}
