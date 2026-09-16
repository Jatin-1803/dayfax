import { useState } from 'react';
import { apiRequest, ApiError } from '../api/client';
import type { AdminUser, RoleCode } from '../api/types';
import { useToast } from './Toast';

const ALL_ROLES: RoleCode[] = ['CUSTOMER', 'DELIVERY_PARTNER', 'ADMIN'];

function statusBadgeClass(status: string): string {
  if (status === 'ACTIVE') return 'badge';
  if (status === 'SUSPENDED') return 'badge badge-warn';
  if (status === 'BANNED' || status === 'BLOCKED') return 'badge badge-danger';
  return 'badge badge-muted';
}

export type UserManageModalProps = {
  user: AdminUser;
  onClose: () => void;
  onUpdated: (user: AdminUser) => void;
  onListRefresh: () => Promise<void>;
  /** Partner page: hide unrelated role grants, emphasize delivery actions */
  partnerMode?: boolean;
};

export function UserManageModal({
  user,
  onClose,
  onUpdated,
  onListRefresh,
  partnerMode = false,
}: UserManageModalProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [accountReason, setAccountReason] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const rolesToShow = partnerMode
    ? ALL_ROLES.filter((r) => r === 'DELIVERY_PARTNER' || user.roles.includes(r))
    : ALL_ROLES;

  async function refreshUser(userId: string) {
    const detail = await apiRequest<AdminUser>(`/admin/users/${userId}`);
    onUpdated(detail);
    return detail;
  }

  async function accountAction(action: string, statusLabel: string, confirm?: string) {
    const reason = accountReason.trim();
    if (reason.length < 3) {
      toast.push('Add a reason (at least 3 characters) before changing the account', 'error');
      return;
    }
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    try {
      await apiRequest(`/admin/users/${user.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      toast.push(statusLabel, 'success');
      setAccountReason('');
      if (action === 'delete') {
        await onListRefresh();
        onClose();
        return;
      }
      await refreshUser(user.id);
      await onListRefresh();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function grantRole(nextRole: RoleCode) {
    setBusy(true);
    try {
      await apiRequest(`/admin/users/${user.id}/roles`, {
        method: 'POST',
        body: JSON.stringify({ role: nextRole }),
      });
      toast.push(`Granted ${nextRole}`, 'success');
      await refreshUser(user.id);
      await onListRefresh();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function revokeRole(nextRole: RoleCode) {
    if (!window.confirm(`Revoke ${nextRole} from this account?`)) return;
    setBusy(true);
    try {
      await apiRequest(`/admin/users/${user.id}/roles/${nextRole}`, {
        method: 'DELETE',
      });
      toast.push(`Revoked ${nextRole}`, 'success');
      await refreshUser(user.id);
      await onListRefresh();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    const reason = accountReason.trim();
    if (reason.length < 3) {
      toast.push('Add a reason before resetting the password', 'error');
      return;
    }
    if (newPassword.length < 8) {
      toast.push('Password must be at least 8 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.push('Passwords do not match', 'error');
      return;
    }
    if (!window.confirm('Set a new password and sign this user out everywhere?')) return;
    setBusy(true);
    try {
      await apiRequest(`/admin/users/${user.id}/password`, {
        method: 'POST',
        body: JSON.stringify({
          reason,
          password: newPassword,
          confirmPassword,
        }),
      });
      toast.push('Password updated; user signed out', 'success');
      setNewPassword('');
      setConfirmPassword('');
      setAccountReason('');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        className="modal modal-lg user-manage-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-manage-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="user-manage-title">{user.fullName || user.phone}</h2>
            <p className="muted user-manage-sub">
              {user.phoneCountryCode} {user.phone}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm modal-close"
            disabled={busy}
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="user-manage-meta">
          <div>
            <span className="meta-label">Status</span>
            <span className={statusBadgeClass(user.status)}>{user.status}</span>
          </div>
          <div>
            <span className="meta-label">Roles</span>
            <span>{user.roles.length ? user.roles.join(', ') : 'none'}</span>
          </div>
          <div className="user-manage-id">
            <span className="meta-label">User ID</span>
            <code title={user.id}>{user.id}</code>
          </div>
        </div>

        <section className="modal-section">
          <h3>Account actions</h3>
          <div className="field">
            <label htmlFor="account-reason">Reason (required)</label>
            <input
              id="account-reason"
              value={accountReason}
              disabled={busy}
              onChange={(event) => setAccountReason(event.target.value)}
              placeholder="Required for status changes, delete, logout, or password reset"
            />
          </div>
          <div className="action-grid">
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy}
              onClick={() => void accountAction('activate', 'Account activated')}
            >
              Activate
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy}
              onClick={() => void accountAction('deactivate', 'Account deactivated')}
            >
              Deactivate
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy}
              onClick={() => void accountAction('suspend', 'Account suspended')}
            >
              Suspend
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy}
              onClick={() => void accountAction('unsuspend', 'Account unsuspended')}
            >
              Unsuspend
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={busy}
              onClick={() => void accountAction('ban', 'Account banned')}
            >
              Ban
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy}
              onClick={() => void accountAction('unban', 'Account unbanned')}
            >
              Unban
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy}
              onClick={() => void accountAction('force-logout', 'Signed out on all devices')}
            >
              Force logout
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={busy}
              onClick={() =>
                void accountAction(
                  'delete',
                  'Account deleted',
                  'Soft-delete this account? They will be removed from lists and signed out.',
                )
              }
            >
              Soft delete
            </button>
          </div>
        </section>

        <section className="modal-section">
          <h3>Password</h3>
          <p className="muted section-hint">
            Set a new login password. The user is signed out on all devices.
          </p>
          <div className="stack user-manage-password">
            <div className="field">
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                disabled={busy}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="field">
              <label htmlFor="confirm-password">Confirm password</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                disabled={busy}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ alignSelf: 'flex-start' }}
              disabled={busy}
              onClick={() => void resetPassword()}
            >
              Update password
            </button>
          </div>
        </section>

        <section className="modal-section">
          <h3>Roles</h3>
          <div className="stack">
            {rolesToShow.map((r) => {
              const has = user.roles.includes(r);
              return (
                <div key={r} className="role-row">
                  <span className="role-label">{r}</span>
                  {has ? (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={busy}
                      onClick={() => void revokeRole(r)}
                    >
                      Revoke
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={() => void grantRole(r)}
                    >
                      Grant
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
