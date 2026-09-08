import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiRequest, ApiError, formatPaise } from '../api/client';
import type {
  AdminOrderSummary,
  AdminUser,
  OrderStatus,
  PaginationMeta,
} from '../api/types';
import { useToast } from '../components/Toast';

const STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'READY_FOR_PICKUP', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['PICKED_UP', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  PICKED_UP: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

function selectableStatuses(current: OrderStatus): OrderStatus[] {
  return [current, ...(ALLOWED_TRANSITIONS[current] ?? [])];
}

interface OrderDetail extends AdminOrderSummary {
  notes: string | null;
  itemTotalPaise: number;
  deliveryFeePaise: number;
  items: Array<{
    id: string;
    productName: string;
    variantLabel: string;
    quantity: number;
    lineTotalPaise: number;
  }>;
  timeline: Array<{
    status: string;
    reached: boolean;
    current: boolean;
  }>;
  address: {
    label: string | null;
    line1: string;
    city: string | null;
  };
}

export function OrdersPage() {
  const [items, setItems] = useState<AdminOrderSummary[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(nextPage = page) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: '20',
      });
      if (status) params.set('status', status);
      if (q.trim()) params.set('q', q.trim());
      const data = await apiRequest<{
        items: AdminOrderSummary[];
        pagination: PaginationMeta;
      }>(`/admin/orders?${params}`);
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Orders</h1>
          <p>Platform-wide order list, status updates, and partner assignment.</p>
        </div>
      </div>

      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          placeholder="Order # or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setPage(1);
            void load(1);
          }}
        >
          Filter
        </button>
      </div>

      {loading ? <div className="loading-box">Loading…</div> : null}
      {error ? <div className="error-box">{error}</div> : null}

      {!loading && !error ? (
        items.length === 0 ? (
          <div className="empty card">No orders found.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Store</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>{o.orderNumber}</strong>
                      <div className="muted">{new Date(o.placedAt).toLocaleString()}</div>
                    </td>
                    <td>
                      {o.customer.fullName || '—'}
                      <div className="muted">
                        {o.customer.phoneCountryCode} {o.customer.phone}
                      </div>
                    </td>
                    <td>{o.store.name}</td>
                    <td>
                      <span className="badge">{o.status}</span>
                    </td>
                    <td>{formatPaise(o.grandTotalPaise, o.currency)}</td>
                    <td>
                      <Link className="btn btn-secondary btn-sm" to={`/orders/${o.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {pagination ? (
        <div className="toolbar" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!pagination.hasPreviousPage}
            onClick={() => {
              const next = page - 1;
              setPage(next);
              void load(next);
            }}
          >
            Previous
          </button>
          <span className="muted">
            Page {pagination.page} / {pagination.totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!pagination.hasNextPage}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              void load(next);
            }}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<OrderStatus>('CONFIRMED');
  const [partnerId, setPartnerId] = useState('');
  const [partners, setPartners] = useState<AdminUser[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadPartners() {
    try {
      const data = await apiRequest<{
        items: AdminUser[];
        pagination: PaginationMeta;
      }>('/admin/delivery-partners?limit=100&page=1');
      setPartners(data.items);
    } catch {
      setPartners([]);
    }
  }

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<OrderDetail>(`/admin/orders/${id}`);
      setOrder(data);
      setNextStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void loadPartners();
  }, [id]);

  async function onStatus(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    try {
      await apiRequest(`/admin/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      toast.push('Status updated', 'success');
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onAssign(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    try {
      await apiRequest(`/admin/orders/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ partnerId }),
      });
      toast.push('Partner assigned', 'success');
      setPartnerId('');
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Assign failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="loading-box">Loading…</div>;
  if (error) return <div className="error-box">{error}</div>;
  if (!order) return <div className="empty">Order not found</div>;

  const statusOptions = selectableStatuses(order.status);
  const statusUnchanged = nextStatus === order.status;

  return (
    <div>
      <div className="page-header">
        <div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/orders')}>
            ← Orders
          </button>
          <h1>{order.orderNumber}</h1>
          <p>
            {order.store.name} · {new Date(order.placedAt).toLocaleString()}
          </p>
        </div>
        <span className="badge">{order.status}</span>
      </div>

      {order.timeline.length > 0 ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ marginTop: 0, fontFamily: 'var(--display)', fontSize: '1.1rem' }}>
            Timeline
          </h2>
          <div className="timeline">
            {order.timeline.map((step) => (
              <span
                key={step.status}
                className={
                  step.current
                    ? 'badge badge-warn'
                    : step.reached
                      ? 'badge'
                      : 'badge badge-muted'
                }
              >
                {step.status}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid-stats">
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.1rem', fontFamily: 'var(--display)' }}>
            Customer
          </h2>
          <p>
            {order.customer.fullName || '—'}
            <br />
            {order.customer.phoneCountryCode} {order.customer.phone}
          </p>
          <p className="muted">
            {order.address.label ? `${order.address.label} · ` : ''}
            {order.address.line1}
            {order.address.city ? `, ${order.address.city}` : ''}
          </p>
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.1rem', fontFamily: 'var(--display)' }}>
            Totals
          </h2>
          <p>
            Items: {formatPaise(order.itemTotalPaise)}
            <br />
            Delivery: {formatPaise(order.deliveryFeePaise)}
            <br />
            <strong>Grand: {formatPaise(order.grandTotalPaise)}</strong>
          </p>
          <p className="muted">
            Payment: {order.payment?.method || '—'} ({order.payment?.status || '—'})
          </p>
          {order.notes ? (
            <p style={{ marginTop: '0.75rem' }}>
              <strong>Notes:</strong> {order.notes}
            </p>
          ) : null}
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.1rem', fontFamily: 'var(--display)' }}>
            Assignment
          </h2>
          {order.assignment ? (
            <p>
              {order.assignment.partnerName || order.assignment.partnerPhone || 'Partner'}
              <br />
              <span className="badge">{order.assignment.status}</span>
            </p>
          ) : (
            <p className="muted">No partner assigned</p>
          )}
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontFamily: 'var(--display)', fontSize: '1.2rem' }}>Items</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Line</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.productName}
                    <div className="muted">{item.variantLabel}</div>
                  </td>
                  <td>{item.quantity}</td>
                  <td>{formatPaise(item.lineTotalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontFamily: 'var(--display)', fontSize: '1.2rem' }}>
          Update status
        </h2>
        <form className="toolbar" onSubmit={onStatus}>
          <select
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
                {s === order.status ? ' (current)' : ''}
              </option>
            ))}
          </select>
          <button className="btn" type="submit" disabled={busy || statusUnchanged}>
            Save status
          </button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontFamily: 'var(--display)', fontSize: '1.2rem' }}>
          Assign partner
        </h2>
        <form className="toolbar" onSubmit={onAssign}>
          <select
            required
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            style={{ minWidth: 280 }}
          >
            <option value="">Select partner</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.fullName || 'Partner') + ` · ${p.phoneCountryCode} ${p.phone}`}
              </option>
            ))}
          </select>
          <button className="btn" type="submit" disabled={busy || !partnerId}>
            Assign
          </button>
        </form>
        {partners.length === 0 ? (
          <p className="muted">No delivery partners found. Add partners on the Partners page.</p>
        ) : null}
      </div>
    </div>
  );
}
