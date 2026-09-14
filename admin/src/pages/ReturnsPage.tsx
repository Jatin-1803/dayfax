import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest, ApiError, formatPaise } from '../api/client';

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://127.0.0.1:3000/api/v1';

function resolvePublicUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const origin = API_BASE.replace(/\/api\/v1$/, '');
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
import { useToast } from '../components/Toast';

interface ReturnSummary {
  id: string;
  orderId: string;
  orderNumber: string;
  status: string;
  refundAmountPaise: number;
  refundMethod: string;
  refundStatus: string;
  customerNote: string;
  createdAt: string;
  customer: { id: string; name: string | null; phone: string | null };
}

interface Payout {
  id: string;
  source: 'RETURN' | 'CANCEL';
  orderId: string;
  orderNumber: string;
  amountPaise: number;
  refundStatus: string;
  customerPhone: string | null;
}

interface ReturnDetail {
  id: string;
  orderId: string;
  orderNumber: string;
  status: string;
  customerNote: string;
  refundAmountPaise: number;
  refundMethod: string;
  refundStatus: string;
  pickupCode: string;
  adminNote: string | null;
  items: Array<{ productName: string; variantLabel: string; quantity: number; lineRefundPaise: number }>;
  photos?: Array<{ id: string; imageUrl: string }>;
  messages: Array<{ id: string; sender: string; body: string; at: string }>;
}

export function ReturnsPage() {
  const toast = useToast();
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [items, setItems] = useState<ReturnSummary[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await apiRequest<{ items: ReturnSummary[]; payouts: Payout[] }>(
        `/admin/returns?status=${encodeURIComponent(status)}`,
      );
      setItems(data.items);
      setPayouts(data.payouts);
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : 'Could not load returns', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [status]);

  async function markCancelPaid(paymentId: string) {
    const payoutRef = window.prompt('Payout reference (optional)') ?? '';
    try {
      await apiRequest(`/admin/returns/payouts/${paymentId}/mark-paid`, {
        method: 'POST',
        body: JSON.stringify({ payoutRef }),
      });
      toast.push('Refund marked paid', 'success');
      await load();
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : 'Could not mark paid', 'error');
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Returns</h1>
      </div>
      <div className="toolbar">
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="PENDING_REVIEW">Waiting for review</option>
          <option value="APPROVED">Approved</option>
          <option value="PICKUP_IN_PROGRESS">Pickup in progress</option>
          <option value="REFUND_PENDING">Refund pending</option>
          <option value="REFUNDED">Refunded</option>
          <option value="REJECTED">Rejected</option>
          <option value="PICKED_UP">Picked up</option>
        </select>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Refund</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}>Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5}>No return requests in this queue.</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.orderNumber}</td>
                  <td>{item.customer.phone ?? item.customer.name ?? 'Customer'}</td>
                  <td><span className="badge">{item.status}</span></td>
                  <td>{formatPaise(item.refundAmountPaise)} · {item.refundMethod}</td>
                  <td><Link to={`/returns/${item.id}`}>Open</Link></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <h2>Manual refunds</h2>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Order</th>
              <th>Source</th>
              <th>Amount</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payouts.length === 0 ? (
              <tr><td colSpan={5}>No manual refunds waiting.</td></tr>
            ) : (
              payouts.map((payout) => (
                <tr key={`${payout.source}-${payout.id}`}>
                  <td>{payout.orderNumber}</td>
                  <td>{payout.source === 'CANCEL' ? 'Cancelled order' : 'Return'}</td>
                  <td>{formatPaise(payout.amountPaise)}</td>
                  <td>{payout.refundStatus}</td>
                  <td>
                    {payout.source === 'CANCEL' ? (
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => void markCancelPaid(payout.id)}>
                        Mark paid
                      </button>
                    ) : (
                      <Link to={`/returns/${payout.id}`}>Open</Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReturnDetailPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const [detail, setDetail] = useState<ReturnDetail | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await apiRequest<ReturnDetail>(`/admin/returns/${id}`);
    setDetail(data);
  }

  useEffect(() => {
    void load().catch((error) => {
      toast.push(error instanceof ApiError ? error.message : 'Could not load return', 'error');
    });
  }, [id]);

  async function act(path: string, body?: Record<string, unknown>) {
    setBusy(true);
    try {
      const data = await apiRequest<ReturnDetail>(`/admin/returns/${id}${path}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      setDetail(data);
      toast.push('Updated', 'success');
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  function reject(event: FormEvent) {
    event.preventDefault();
    if (note.trim().length < 3) {
      toast.push('Add a short reason', 'error');
      return;
    }
    void act('/reject', { note });
  }

  if (!detail) return <p>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Return · {detail.orderNumber}</h1>
        <Link to="/returns">Back</Link>
      </div>
      <div className="card">
        <p><span className="badge">{detail.status}</span> · {formatPaise(detail.refundAmountPaise)} · {detail.refundMethod}</p>
        <p>{detail.customerNote}</p>
        <ul>
          {detail.items.map((item) => (
            <li key={`${item.productName}-${item.quantity}`}>
              {item.productName} ({item.variantLabel}) × {item.quantity}
            </li>
          ))}
        </ul>
        {detail.photos && detail.photos.length > 0 ? (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            {detail.photos.map((photo) => (
              <a key={photo.id} href={resolvePublicUrl(photo.imageUrl)} target="_blank" rel="noreferrer">
                <img
                  src={resolvePublicUrl(photo.imageUrl)}
                  alt="Damaged product"
                  style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8 }}
                />
              </a>
            ))}
          </div>
        ) : null}
        {detail.status === 'PENDING_REVIEW' ? (
          <div className="modal-actions">
            <button className="btn" type="button" disabled={busy} onClick={() => void act('/approve')}>
              Approve pickup
            </button>
          </div>
        ) : null}
        {['REFUND_PENDING', 'PICKED_UP'].includes(detail.status) && detail.refundMethod === 'MANUAL' ? (
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => void act('/mark-paid', { payoutRef: note })}
          >
            Mark refund paid
          </button>
        ) : null}
        {detail.refundStatus === 'FAILED' ? (
          <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void act('/retry-refund')}>
            Retry online refund
          </button>
        ) : null}
      </div>
      {detail.status === 'PENDING_REVIEW' ? (
        <form className="card" onSubmit={reject}>
          <label>
            Reject reason
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
          </label>
          <button className="btn btn-secondary" type="submit" disabled={busy}>Reject</button>
        </form>
      ) : null}
      <h2>Chat</h2>
      <div className="card">
        {detail.messages.length === 0 ? <p>No messages</p> : detail.messages.map((message) => (
          <p key={message.id}><strong>{message.sender === 'AGENT' ? 'Ananya' : 'Customer'}:</strong> {message.body}</p>
        ))}
      </div>
    </div>
  );
}
