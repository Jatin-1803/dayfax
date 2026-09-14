import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiRequest } from '../api/client';
import type { OrderDeliveryAlert, PaginationMeta } from '../api/types';
import { useToast } from '../components/Toast';

function formatWhen(iso: string | null) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusClass(status: string) {
  if (status === 'SENT' || status === 'OPENED') return 'badge';
  if (status === 'FAILED') return 'badge badge-danger';
  if (status === 'EXPIRED') return 'badge badge-warn';
  return 'badge badge-muted';
}

export function OrderAlertsPage() {
  const toast = useToast();
  const [items, setItems] = useState<OrderDeliveryAlert[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  async function load(nextPage = page, filterOrderId = orderId) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: '50',
      });
      if (filterOrderId.trim()) params.set('orderId', filterOrderId.trim());
      const data = await apiRequest<{ items: OrderDeliveryAlert[]; pagination: PaginationMeta }>(
        `/admin/notifications/order-alerts?${params.toString()}`,
      );
      setItems(data.items);
      setPagination(data.pagination);
      setPage(data.pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order alerts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1, '');
  }, []);

  function onFilter(event: FormEvent) {
    event.preventDefault();
    void load(1, orderId);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Order delivery alerts</h1>
          <p>Debug trail for partner new-order pushes (sent, failed, expired, accepted).</p>
        </div>
      </div>

      <form className="toolbar" onSubmit={onFilter} style={{ marginBottom: '1rem' }}>
        <input
          type="search"
          placeholder="Filter by order ID"
          value={orderId}
          onChange={(event) => setOrderId(event.target.value)}
        />
        <button type="submit" className="btn">
          Filter
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setOrderId('');
            void load(1, '');
          }}
        >
          Clear
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            void load(page, orderId);
            toast.push('Refreshed', 'success');
          }}
        >
          Refresh
        </button>
      </form>

      {error ? <p className="muted">{error}</p> : null}
      {loading ? <p className="muted">Loading…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="muted">No partner order alerts recorded yet.</p>
      ) : null}

      {items.length > 0 ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Order</th>
                <th>Partner</th>
                <th>Type</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Sent</th>
                <th>Failure</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div>{row.orderNumber ?? '—'}</div>
                    <small className="muted">{row.orderId}</small>
                  </td>
                  <td>
                    <div>{row.partnerName ?? '—'}</div>
                    <small className="muted">{row.deliveryBoyId}</small>
                  </td>
                  <td>{row.notificationType}</td>
                  <td>
                    <span className={statusClass(row.status)}>{row.status}</span>
                  </td>
                  <td>{row.attemptCount}</td>
                  <td>{formatWhen(row.sentAt)}</td>
                  <td>{row.failureReason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pagination && pagination.totalPages > 1 ? (
        <div className="toolbar">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!pagination.hasPreviousPage}
            onClick={() => void load(page - 1, orderId)}
          >
            Previous
          </button>
          <span className="muted">
            Page {pagination.page} / {pagination.totalPages}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!pagination.hasNextPage}
            onClick={() => void load(page + 1, orderId)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
