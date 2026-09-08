import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import type { AdminStore, PaginationMeta } from '../api/types';

export function DashboardPage() {
  const [storeCount, setStoreCount] = useState<number | null>(null);
  const [confirmedCount, setConfirmedCount] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [searchStatus, setSearchStatus] = useState<{
    meilisearchEnabled: boolean;
    synonymGroups: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stores, status, confirmed, pending] = await Promise.all([
          apiRequest<AdminStore[]>('/admin/stores'),
          apiRequest<{ meilisearchEnabled: boolean; synonymGroups: number }>(
            '/admin/search/status',
          ),
          apiRequest<{ items: unknown[]; pagination: PaginationMeta }>(
            '/admin/orders?status=CONFIRMED&limit=1&page=1',
          ),
          apiRequest<{ items: unknown[]; pagination: PaginationMeta }>(
            '/admin/orders?status=PENDING&limit=1&page=1',
          ),
        ]);
        if (cancelled) return;
        setStoreCount(stores.length);
        setSearchStatus(status);
        setConfirmedCount(confirmed.pagination.total);
        setPendingCount(pending.pagination.total);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openOrders = (confirmedCount ?? 0) + (pendingCount ?? 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Quick view of stores, orders, and search health.</p>
        </div>
      </div>
      {loading ? <div className="loading-box">Loading…</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      {!loading && !error ? (
        <div className="grid-stats">
          <div className="card stat">
            <span>Stores</span>
            <strong>{storeCount ?? 0}</strong>
            <Link to="/stores">Manage stores →</Link>
          </div>
          <div className="card stat">
            <span>Open orders</span>
            <strong>{openOrders}</strong>
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              {pendingCount ?? 0} pending · {confirmedCount ?? 0} confirmed
            </div>
            <Link to="/orders">View orders →</Link>
          </div>
          <div className="card stat">
            <span>Synonym groups</span>
            <strong>{searchStatus?.synonymGroups ?? 0}</strong>
            <Link to="/search">Search ops →</Link>
          </div>
          <div className="card stat">
            <span>Meilisearch</span>
            <strong style={{ fontSize: '1.2rem' }}>
              {searchStatus?.meilisearchEnabled ? 'Enabled' : 'Off'}
            </strong>
            <Link to="/search">Search ops →</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
