import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiRequest, ApiError } from '../api/client';
import type { AdminUser, PaginationMeta, RoleCode } from '../api/types';
import { useToast } from '../components/Toast';

const ALL_ROLES: RoleCode[] = ['CUSTOMER', 'DELIVERY_PARTNER', 'ADMIN'];

export function UsersPage() {
  const toast = useToast();
  const [items, setItems] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(nextPage = page) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: '20',
      });
      if (q.trim()) params.set('q', q.trim());
      if (role) params.set('role', role);
      const data = await apiRequest<{
        items: AdminUser[];
        pagination: PaginationMeta;
      }>(`/admin/users?${params}`);
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
  }, []);

  async function grantRole(userId: string, nextRole: RoleCode) {
    setBusy(true);
    try {
      await apiRequest(`/admin/users/${userId}/roles`, {
        method: 'POST',
        body: JSON.stringify({ role: nextRole }),
      });
      toast.push(`Granted ${nextRole}`, 'success');
      await load(page);
      if (selected?.id === userId) {
        const detail = await apiRequest<AdminUser>(`/admin/users/${userId}`);
        setSelected(detail);
      }
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function revokeRole(userId: string, nextRole: RoleCode) {
    if (!window.confirm(`Revoke ${nextRole}?`)) return;
    setBusy(true);
    try {
      await apiRequest(`/admin/users/${userId}/roles/${nextRole}`, {
        method: 'DELETE',
      });
      toast.push(`Revoked ${nextRole}`, 'success');
      await load(page);
      if (selected?.id === userId) {
        const detail = await apiRequest<AdminUser>(`/admin/users/${userId}`);
        setSelected(detail);
      }
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    void load(1);
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      toast.push('ID copied', 'success');
    } catch {
      toast.push('Could not copy', 'error');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p>Search accounts and manage roles.</p>
        </div>
      </div>

      <form className="toolbar" onSubmit={onSearch}>
        <input
          placeholder="Phone or name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-secondary">
          Search
        </button>
      </form>

      {loading ? <div className="loading-box">Loading…</div> : null}
      {error ? <div className="error-box">{error}</div> : null}

      {!loading && !error ? (
        items.length === 0 ? (
          <div className="empty card">No users found.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.fullName || '—'}</strong>
                      <div className="muted">
                        {u.phoneCountryCode} {u.phone}
                      </div>
                      <div className="muted" style={{ fontSize: '0.75rem' }}>
                        {u.id}
                      </div>
                    </td>
                    <td>{u.roles.join(', ') || '—'}</td>
                    <td>
                      <span className="badge">{u.status}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => void copyId(u.id)}
                        >
                          Copy ID
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelected(u)}
                        >
                          Manage
                        </button>
                      </div>
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

      {selected ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>{selected.fullName || selected.phone}</h2>
            <p className="muted">
              {selected.phoneCountryCode} {selected.phone}
              <br />
              <code>{selected.id}</code>
            </p>
            <p>
              Current roles:{' '}
              {selected.roles.length ? selected.roles.join(', ') : 'none'}
            </p>
            <div className="stack">
              {ALL_ROLES.map((r) => {
                const has = selected.roles.includes(r);
                return (
                  <div key={r} className="row-actions" style={{ alignItems: 'center' }}>
                    <span style={{ minWidth: 160 }}>{r}</span>
                    {has ? (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={busy}
                        onClick={() => void revokeRole(selected.id, r)}
                      >
                        Revoke
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={busy}
                        onClick={() => void grantRole(selected.id, r)}
                      >
                        Grant
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
