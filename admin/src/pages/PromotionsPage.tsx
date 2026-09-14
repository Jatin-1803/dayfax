import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiRequest } from '../api/client';
import type { PromoNotification } from '../api/types';
import { useToast } from '../components/Toast';

type Audience = 'CUSTOMERS' | 'PARTNERS' | 'ALL';

type PromoForm = {
  audience: Audience;
  title: string;
  titleHi: string;
  body: string;
  bodyHi: string;
};

const emptyForm = (): PromoForm => ({
  audience: 'CUSTOMERS',
  title: '',
  titleHi: '',
  body: '',
  bodyHi: '',
});

function audienceLabel(audience: Audience) {
  if (audience === 'PARTNERS') return 'Delivery partners';
  if (audience === 'ALL') return 'Customers and partners';
  return 'Customers';
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function PromotionsPage() {
  const toast = useToast();
  const [history, setHistory] = useState<PromoNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PromoForm>(emptyForm);
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setHistory(await apiRequest<PromoNotification[]>('/admin/notifications'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load promotions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const title = form.title.trim();
    const titleHi = form.titleHi.trim();
    const body = form.body.trim();
    const bodyHi = form.bodyHi.trim();
    if (!title || !body) {
      toast.push('Enter the title and message in English.', 'error');
      return;
    }

    const confirmed = window.confirm(
      `Send this promotion to ${audienceLabel(form.audience).toLowerCase()}?`,
    );
    if (!confirmed) return;

    setSending(true);
    try {
      const result = await apiRequest<{
        recipientCount: number;
        sentCount: number;
        failedCount: number;
      }>('/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({
          audience: form.audience,
          title,
          titleHi,
          body,
          bodyHi,
        }),
      });
      toast.push(`Sent to ${result.sentCount} of ${result.recipientCount} devices.`, 'success');
      setForm(emptyForm());
      await load();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Could not send promotion', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Promotions</h1>
          <p>Send a push notification to people who have the app installed.</p>
        </div>
      </div>

      <form className="card" onSubmit={onSubmit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="promo-audience">Send to</label>
            <select
              id="promo-audience"
              value={form.audience}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  audience: event.target.value as Audience,
                }))
              }
            >
              <option value="CUSTOMERS">Customers</option>
              <option value="PARTNERS">Delivery partners</option>
              <option value="ALL">Customers and partners</option>
            </select>
          </div>
        </div>
        <div className="form-grid" style={{ marginTop: '0.85rem' }}>
          <div className="field">
            <label htmlFor="promo-title">Title (English)</label>
            <input
              id="promo-title"
              value={form.title}
              maxLength={160}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="promo-title-hi">Title (Hindi, optional)</label>
            <input
              id="promo-title-hi"
              value={form.titleHi}
              maxLength={160}
              onChange={(event) =>
                setForm((current) => ({ ...current, titleHi: event.target.value }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="promo-body">Message (English)</label>
            <textarea
              id="promo-body"
              value={form.body}
              maxLength={500}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="promo-body-hi">Message (Hindi, optional)</label>
            <textarea
              id="promo-body-hi"
              value={form.bodyHi}
              maxLength={500}
              onChange={(event) =>
                setForm((current) => ({ ...current, bodyHi: event.target.value }))
              }
            />
          </div>
        </div>
        <div className="toolbar" style={{ marginTop: '1rem', marginBottom: 0 }}>
          <button type="submit" className="btn" disabled={sending}>
            {sending ? 'Sending…' : 'Send notification'}
          </button>
        </div>
      </form>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Recent sends</h2>
        {loading ? <p>Loading…</p> : null}
        {error ? <p>{error}</p> : null}
        {!loading && history.length === 0 ? <p>No promotions sent yet.</p> : null}
        {history.length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Audience</th>
                  <th>Message</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{formatWhen(item.createdAt)}</td>
                    <td>{audienceLabel(item.audience)}</td>
                    <td>
                      <strong>{item.title}</strong>
                      <div>{item.body}</div>
                    </td>
                    <td>
                      {item.sentCount} / {item.recipientCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
