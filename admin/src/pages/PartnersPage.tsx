import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiRequest, ApiError } from '../api/client';
import type { AdminUser, PaginationMeta, RoleCode } from '../api/types';
import { UserManageModal } from '../components/UserManageModal';
import { useToast } from '../components/Toast';

function statusBadgeClass(status: string): string {
  if (status === 'ACTIVE') return 'badge';
  if (status === 'SUSPENDED') return 'badge badge-warn';
  if (status === 'BANNED' || status === 'BLOCKED') return 'badge badge-danger';
  return 'badge badge-muted';
}

export function PartnersPage() {
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

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
        items: AdminUser[];
        pagination: PaginationMeta;
      }>(`/admin/delivery-partners?${params}`);
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load partners');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1, '');
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await apiRequest<{
        id: string;
        phone: string;
        fullName: string | null;
        roles: RoleCode[];
        created: boolean;
        roleAdded: boolean;
      }>('/admin/delivery-partners', {
        method: 'POST',
        body: JSON.stringify({
          phoneCountryCode: '+91',
          phone,
          fullName: fullName.trim() || undefined,
        }),
      });
      toast.push(
        data.created
          ? 'Partner created'
          : data.roleAdded
            ? 'Partner role granted'
            : 'Partner already exists',
        'success',
      );
      setPhone('');
      setFullName('');
      await load(1, q);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
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
      toast.push(err instanceof ApiError ? err.message : 'Could not load partner', 'error');
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Delivery partners</h1>
          <p>List partners and create or promote by phone.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 520, marginBottom: '1rem' }}>
        <form className="stack" onSubmit={onSubmit}>
          <div className="field">
            <label>Mobile number</label>
            <input
              required
              inputMode="numeric"
              maxLength={10}
              pattern="[6-9][0-9]{9}"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit Indian mobile"
            />
          </div>
          <div className="field">
            <label>Full name (optional)</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={saving || phone.length !== 10}>
            {saving ? 'Saving…' : 'Create / promote partner'}
          </button>
        </form>
      </div>

      <div className="toolbar">
        <input placeholder="Search phone or name" value={q} onChange={(e) => setQ(e.target.value)} />
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
      {!loading && !error && items.length === 0 ? (
        <div className="empty card">No delivery partners yet.</div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Partner</th>
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

      {selected ? (
        <UserManageModal
          user={selected}
          partnerMode
          onClose={() => setSelected(null)}
          onUpdated={setSelected}
          onListRefresh={async () => load(page, q)}
        />
      ) : null}
    </div>
  );
}
