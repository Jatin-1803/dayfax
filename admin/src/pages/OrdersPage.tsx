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
    isLocalShop?: boolean;
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
  const [codOpen, setCodOpen] = useState(false);
  const [paymentReceived, setPaymentReceived] = useState<'CASH' | 'UPI' | 'CARD' | ''>('');
  const [deliveryNote, setDeliveryNote] = useState('');

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

  async function saveStatus(body: {
    status: OrderStatus;
    note?: string;
    paymentReceived?: 'CASH' | 'UPI' | 'CARD';
  }) {
    if (!id) return;
    setBusy(true);
    try {
      await apiRequest(`/admin/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      toast.push('Status updated', 'success');
      setCodOpen(false);
      setPaymentReceived('');
      setDeliveryNote('');
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onStatus(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (nextStatus === 'DELIVERED' && order?.payment?.method === 'COD') {
      setPaymentReceived('');
      setDeliveryNote('');
      setCodOpen(true);
      return;
    }
    await saveStatus({ status: nextStatus });
  }

  async function confirmCodDelivery(e: FormEvent) {
    e.preventDefault();
    if (!paymentReceived) {
      toast.push('Choose how the payment was received', 'error');
      return;
    }
    if (deliveryNote.trim().length < 3) {
      toast.push('Add a short note about the payment', 'error');
      return;
    }
    await saveStatus({
      status: 'DELIVERED',
      note: deliveryNote.trim(),
      paymentReceived,
    });
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
          <ItemGroupTotals items={order.items} />
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

      <OrderItemGroups items={order.items} />

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

      {codOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => !busy && setCodOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cod-delivery-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="cod-delivery-title">Confirm COD delivery</h2>
            <p className="muted">
              This order is cash on delivery. Record how payment was received before marking it delivered.
              The delivery partner job will be marked completed too.
            </p>
            <p>
              Amount due:{' '}
              <strong>{formatPaise(order.grandTotalPaise)}</strong>
              {order.payment?.status ? ` · currently ${order.payment.status}` : ''}
            </p>
            <form className="stack" onSubmit={confirmCodDelivery}>
              <div className="field">
                <label htmlFor="payment-received">How was payment received?</label>
                <select
                  id="payment-received"
                  required
                  value={paymentReceived}
                  onChange={(e) => setPaymentReceived(e.target.value as 'CASH' | 'UPI' | 'CARD' | '')}
                >
                  <option value="">Select method</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="delivery-note">Note</label>
                <textarea
                  id="delivery-note"
                  required
                  minLength={3}
                  maxLength={500}
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  placeholder="Who collected it, reference, or any detail"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => setCodOpen(false)}
                >
                  Cancel
                </button>
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Mark delivered'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

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

type OrderLine = OrderDetail['items'][number];

function groupSubtotal(items: OrderLine[], local: boolean) {
  return items
    .filter((item) => Boolean(item.isLocalShop) === local)
    .reduce((sum, item) => sum + item.lineTotalPaise, 0);
}

function ItemGroupTotals({ items }: { items: OrderLine[] }) {
  const local = items.filter((item) => item.isLocalShop);
  const regular = items.filter((item) => !item.isLocalShop);
  if (local.length === 0 || regular.length === 0) return null;
  return (
    <p className="muted" style={{ marginTop: '0.75rem' }}>
      Local shop items: {formatPaise(groupSubtotal(items, true))}
      <br />
      Other items: {formatPaise(groupSubtotal(items, false))}
    </p>
  );
}

function ItemTable({ items }: { items: OrderLine[] }) {
  return (
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
          {items.map((item) => (
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
  );
}

function OrderItemGroups({ items }: { items: OrderLine[] }) {
  const local = items.filter((item) => item.isLocalShop);
  const regular = items.filter((item) => !item.isLocalShop);
  const mixed = local.length > 0 && regular.length > 0;

  if (!mixed) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0, fontFamily: 'var(--display)', fontSize: '1.2rem' }}>Items</h2>
        {local.length > 0 ? (
          <p>
            <span className="badge badge-warn">Local shop · prepaid, no return</span>
          </p>
        ) : null}
        <ItemTable items={items} />
      </div>
    );
  }

  return (
    <>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginTop: 0, fontFamily: 'var(--display)', fontSize: '1.2rem' }}>
          Local shop <span className="badge badge-warn">Prepaid, no return</span>
        </h2>
        <p className="muted">Pay online. These items cannot be returned or refunded.</p>
        <p>
          <strong>Group total: {formatPaise(groupSubtotal(items, true))}</strong>
        </p>
        <ItemTable items={local} />
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0, fontFamily: 'var(--display)', fontSize: '1.2rem' }}>
          Other items <span className="badge">Cash on delivery</span>
        </h2>
        <p className="muted">These items can be paid cash on delivery.</p>
        <p>
          <strong>Group total: {formatPaise(groupSubtotal(items, false))}</strong>
        </p>
        <ItemTable items={regular} />
      </div>
    </>
  );
}
