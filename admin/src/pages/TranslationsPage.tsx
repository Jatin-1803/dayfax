import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiRequest, ApiError } from '../api/client';
import type { PaginationMeta } from '../api/types';
import { useToast } from '../components/Toast';

interface StringItem {
  key: string;
  en: string;
  hi: string;
  updatedAt?: string;
}

export function TranslationsPage() {
  const toast = useToast();
  const [items, setItems] = useState<StringItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<StringItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ key: '', en: '', hi: '' });
  const [saving, setSaving] = useState(false);

  async function load(nextPage = page, search = q) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: '50',
      });
      if (search.trim()) params.set('q', search.trim());
      const data = await apiRequest<{
        version: number;
        items: StringItem[];
        pagination: PaginationMeta;
      }>(`/admin/i18n/strings?${params}`);
      setItems(data.items);
      setPagination(data.pagination);
      setVersion(data.version);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load strings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1, '');
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/admin/i18n/strings', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      toast.push('String created', 'success');
      setCreateOpen(false);
      setForm({ key: '', en: '', hi: '' });
      await load(1, q);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Create failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    try {
      await apiRequest(`/admin/i18n/strings/${encodeURIComponent(edit.key)}`, {
        method: 'PUT',
        body: JSON.stringify({ en: form.en, hi: form.hi }),
      });
      toast.push('String updated', 'success');
      setEdit(null);
      await load(page, q);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(key: string) {
    if (!window.confirm(`Delete string “${key}”?`)) return;
    try {
      await apiRequest(`/admin/i18n/strings/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      toast.push('Deleted', 'success');
      await load(page, q);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Translations</h1>
          <p>
            UI string bundle{version != null ? ` · version ${version}` : ''}. Changes bump the
            app bundle version.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setCreateOpen(true)}>
          Add string
        </button>
      </div>

      <div className="toolbar">
        <input
          placeholder="Search key or text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setPage(1);
            void load(1, q);
          }}
        >
          Search
        </button>
      </div>

      {loading ? <div className="loading-box">Loading…</div> : null}
      {error ? <div className="error-box">{error}</div> : null}

      {!loading && !error ? (
        items.length === 0 ? (
          <div className="empty card">No strings found.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>English</th>
                  <th>Hindi</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.key}>
                    <td>
                      <code>{item.key}</code>
                    </td>
                    <td>{item.en}</td>
                    <td>{item.hi}</td>
                    <td className="row-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEdit(item);
                          setForm({ key: item.key, en: item.en, hi: item.hi });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => void onDelete(item.key)}
                      >
                        Delete
                      </button>
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
              void load(next, q);
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
              void load(next, q);
            }}
          >
            Next
          </button>
        </div>
      ) : null}

      {createOpen ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>New string</h2>
            <form className="stack" onSubmit={onCreate}>
              <div className="field">
                <label>Key</label>
                <input
                  required
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value })}
                  placeholder="feature.key"
                />
              </div>
              <div className="field">
                <label>English</label>
                <textarea
                  required
                  value={form.en}
                  onChange={(e) => setForm({ ...form, en: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Hindi</label>
                <textarea
                  required
                  value={form.hi}
                  onChange={(e) => setForm({ ...form, hi: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? 'Saving…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {edit ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Edit {edit.key}</h2>
            <form className="stack" onSubmit={onSave}>
              <div className="field">
                <label>English</label>
                <textarea
                  required
                  value={form.en}
                  onChange={(e) => setForm({ ...form, en: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Hindi</label>
                <textarea
                  required
                  value={form.hi}
                  onChange={(e) => setForm({ ...form, hi: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEdit(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
