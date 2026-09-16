import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiRequest, ApiError } from '../api/client';
import type { AdminUser, PaginationMeta, RoleCode } from '../api/types';
import { UserManageModal } from '../components/UserManageModal';
import { useToast } from '../components/Toast';

const ALL_ROLES: RoleCode[] = ['CUSTOMER', 'DELIVERY_PARTNER', 'ADMIN'];

function statusBadgeClass(status: string): string {
  if (status === 'ACTIVE') return 'badge';
  if (status === 'SUSPENDED') return 'badge badge-warn';
  if (status === 'BANNED' || status === 'BLOCKED') return 'badge badge-danger';
  return 'badge badge-muted';
}

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
  const [openingId, setOpeningId] = useState<string | null>(null);

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

  async function openManage(u: AdminUser) {
    setOpeningId(u.id);
    try {
      const detail = await apiRequest<AdminUser>(`/admin/users/${u.id}`);
      setSelected(detail);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Could not load user', 'error');
    } finally {
      setOpeningId(null);
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
                    </td>
                    <td>{u.roles.join(', ') || '—'}</td>
                    <td>
                      <span className={statusBadgeClass(u.status)}>{u.status}</span>
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
                          disabled={openingId === u.id}
                          onClick={() => void openManage(u)}
                        >
                          {openingId === u.id ? 'Opening…' : 'Manage'}
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
        <UserManageModal
          user={selected}
          onClose={() => setSelected(null)}
          onUpdated={setSelected}
          onListRefresh={async () => load(page)}
        />
      ) : null}
    </div>
  );
}
