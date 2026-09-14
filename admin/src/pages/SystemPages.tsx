import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiRequest, ApiError } from '../api/client';
import { useToast } from '../components/Toast';

type Release = {
  id: string;
  platform: string;
  version: string;
  buildNumber: number;
  minVersion: string;
  minBuild: number;
  storeUrl: string | null;
  title: string;
  message: string;
  forceUpdate: boolean;
  isActive: boolean;
  createdAt: string;
};

type Flag = {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  rolloutPercentage: number;
  platform: string;
};

type Setting = { key: string; value: string; type: string };
type Control = { code: string; enabled: boolean; reason: string | null; expiresAt: string | null };
type Announcement = { id: string; title: string; message: string; severity: string; isActive: boolean };
type AuditItem = {
  id: string;
  created_at: string;
  action: string;
  module: string;
  actor_id: string | null;
  reason: string | null;
};
type Health = {
  api: string;
  database: string;
  databaseMs: number;
  razorpayConfigured: boolean;
  pushConfigured: boolean;
  failedWebhooks24h: number;
  uptimeSeconds: number;
};

function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      setData(await apiRequest<T>(path));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [path]);

  return { data, error, loading, reload };
}

function PageState({ loading, error, empty }: { loading: boolean; error: string | null; empty?: string }) {
  if (loading) return <div className="loading-box">Loading…</div>;
  if (error) return <div className="error-box">{error}</div>;
  if (empty) return <div className="empty card">{empty}</div>;
  return null;
}

function formatWhen(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function controlLabel(code: string) {
  if (code === 'login_otp') return 'OTP login (customer)';
  if (code === 'login') return 'All customer sign-in';
  if (code === 'registration') return 'New registrations';
  return code.replaceAll('_', ' ');
}

export function VersionsPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad<Release[]>('/admin/system/releases');
  const [platform, setPlatform] = useState<'ANDROID' | 'IOS'>('ANDROID');
  const [version, setVersion] = useState('1.0.1');
  const [buildNumber, setBuildNumber] = useState('2');
  const [minVersion, setMinVersion] = useState('1.0.0');
  const [minBuild, setMinBuild] = useState('1');
  const [storeUrl, setStoreUrl] = useState('');
  const [title, setTitle] = useState('New version available');
  const [message, setMessage] = useState('Please update for the latest improvements.');
  const [forceUpdate, setForceUpdate] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (reason.trim().length < 3) {
      toast.push('Add a short reason for this change', 'error');
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/admin/system/releases', {
        method: 'POST',
        body: JSON.stringify({
          platform,
          version,
          buildNumber: Number(buildNumber),
          minVersion,
          minBuild: Number(minBuild),
          storeUrl: storeUrl || null,
          title,
          message,
          forceUpdate,
          isActive: true,
          reason: reason.trim(),
        }),
      });
      toast.push('Version policy saved', 'success');
      setReason('');
      await reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function activate(id: string) {
    const nextReason = window.prompt('Reason for activating this policy');
    if (!nextReason || nextReason.trim().length < 3) return;
    try {
      await apiRequest(`/admin/system/releases/${id}/activate`, {
        method: 'POST',
        body: JSON.stringify({ reason: nextReason.trim() }),
      });
      toast.push('Policy activated', 'success');
      await reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    }
  }

  const releases = data ?? [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>App version</h1>
          <p>Set the latest and minimum supported build for Android and iOS. Publishing a policy does not change the installed app.</p>
        </div>
      </div>

      <form className="card stack" onSubmit={(event) => void publish(event)}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="platform">Platform</label>
            <select id="platform" value={platform} onChange={(event) => setPlatform(event.target.value as 'ANDROID' | 'IOS')}>
              <option value="ANDROID">Android</option>
              <option value="IOS">iOS</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="latest-version">Latest version</label>
            <input id="latest-version" value={version} onChange={(event) => setVersion(event.target.value)} placeholder="1.4.0" />
          </div>
          <div className="field">
            <label htmlFor="latest-build">Latest build</label>
            <input id="latest-build" inputMode="numeric" value={buildNumber} onChange={(event) => setBuildNumber(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="min-version">Minimum version</label>
            <input id="min-version" value={minVersion} onChange={(event) => setMinVersion(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="min-build">Minimum build</label>
            <input id="min-build" inputMode="numeric" value={minBuild} onChange={(event) => setMinBuild(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="store-url">Store URL</label>
            <input id="store-url" value={storeUrl} onChange={(event) => setStoreUrl(event.target.value)} placeholder="https://play.google.com/..." />
            <span className="hint">Used by the Update button in the app.</span>
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="update-title">Update title</label>
            <input id="update-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="update-message">Message</label>
            <input id="update-message" value={message} onChange={(event) => setMessage(event.target.value)} />
          </div>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={forceUpdate} onChange={(event) => setForceUpdate(event.target.checked)} />
          <span>
            <strong>Force update below minimum</strong>
            <span>Customers on an older build see a blocking screen and cannot continue.</span>
          </span>
        </label>
        <div className="field">
          <label htmlFor="version-reason">Reason</label>
          <input id="version-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why this policy is changing" />
        </div>
        <div className="form-actions">
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Publish policy'}</button>
        </div>
      </form>

      <div className="section-gap">
        <PageState loading={loading} error={error} empty={!loading && !error && releases.length === 0 ? 'No version policies yet.' : undefined} />
        {!loading && !error && releases.length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Version</th>
                  <th>Minimum</th>
                  <th>Force</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {releases.map((row) => (
                  <tr key={row.id}>
                    <td>{row.platform === 'IOS' ? 'iOS' : 'Android'}</td>
                    <td>
                      <strong>{row.version}</strong>
                      <div className="muted">Build {row.buildNumber}</div>
                    </td>
                    <td>
                      {row.minVersion}
                      <div className="muted">Build {row.minBuild}</div>
                    </td>
                    <td>{row.forceUpdate ? <span className="badge badge-warn">On</span> : <span className="badge badge-muted">Off</span>}</td>
                    <td>{row.isActive ? <span className="badge">Active</span> : <span className="badge badge-muted">History</span>}</td>
                    <td>
                      {row.isActive ? null : (
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => void activate(row.id)}>
                          Use this policy
                        </button>
                      )}
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

export function FeatureFlagsPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad<Flag[]>('/admin/system/feature-flags');
  const [key, setKey] = useState('new_checkout');
  const [name, setName] = useState('New checkout');
  const [enabled, setEnabled] = useState(false);
  const [rollout, setRollout] = useState('100');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (reason.trim().length < 3) {
      toast.push('Add a short reason', 'error');
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/admin/system/feature-flags', {
        method: 'POST',
        body: JSON.stringify({
          flagKey: key,
          name,
          enabled,
          platform: 'ALL',
          rolloutPercentage: Number(rollout),
          environment: 'ALL',
          reason: reason.trim(),
        }),
      });
      toast.push('Flag saved', 'success');
      setReason('');
      await reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  const flags = data ?? [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Feature flags</h1>
          <p>Turn features on for everyone, or roll them out to a stable percentage of customers.</p>
        </div>
      </div>

      <form className="card stack" onSubmit={(event) => void save(event)}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="flag-key">Key</label>
            <input id="flag-key" value={key} onChange={(event) => setKey(event.target.value)} placeholder="new_checkout" />
          </div>
          <div className="field">
            <label htmlFor="flag-name">Name</label>
            <input id="flag-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="flag-rollout">Rollout percentage</label>
            <input id="flag-rollout" inputMode="numeric" value={rollout} onChange={(event) => setRollout(event.target.value)} />
            <span className="hint">The same customer stays in or out of the rollout.</span>
          </div>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          <span>
            <strong>Enabled</strong>
            <span>Off means nobody receives this feature, regardless of rollout.</span>
          </span>
        </label>
        <div className="field">
          <label htmlFor="flag-reason">Reason</label>
          <input id="flag-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        <div className="form-actions">
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save flag'}</button>
        </div>
      </form>

      <div className="section-gap">
        <PageState loading={loading} error={error} empty={!loading && !error && flags.length === 0 ? 'No feature flags yet.' : undefined} />
        {!loading && !error && flags.length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Flag</th>
                  <th>Status</th>
                  <th>Rollout</th>
                  <th>Platform</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <div className="muted">{row.key}</div>
                    </td>
                    <td>{row.enabled ? <span className="badge">On</span> : <span className="badge badge-muted">Off</span>}</td>
                    <td>{row.rolloutPercentage}%</td>
                    <td>{row.platform}</td>
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

export function AppConfigPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad<Setting[]>('/admin/system/app-config');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const row of data) next[row.key] = row.value;
    setDrafts(next);
  }, [data]);

  async function save(row: Setting) {
    const reason = (reasons[row.key] ?? '').trim();
    if (reason.length < 3) {
      toast.push('Add a reason before saving', 'error');
      return;
    }
    setSavingKey(row.key);
    try {
      await apiRequest(`/admin/system/app-config/${row.key}`, {
        method: 'PUT',
        body: JSON.stringify({ value: drafts[row.key] ?? row.value, reason }),
      });
      toast.push('Setting saved', 'success');
      await reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>App configuration</h1>
          <p>Session timeouts and lockout limits. These apply on the server, not only in the app.</p>
        </div>
      </div>
      <PageState loading={loading} error={error} />
      {!loading && !error ? (
        <div className="stack">
          {(data ?? []).map((row) => (
            <div className="card" key={row.key}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor={`cfg-${row.key}`}>{row.key.replaceAll('_', ' ')}</label>
                  <input
                    id={`cfg-${row.key}`}
                    value={drafts[row.key] ?? row.value}
                    onChange={(event) => setDrafts((current) => ({ ...current, [row.key]: event.target.value }))}
                  />
                  <span className="hint">Current type: {row.type}</span>
                </div>
                <div className="field">
                  <label htmlFor={`reason-${row.key}`}>Reason</label>
                  <input
                    id={`reason-${row.key}`}
                    value={reasons[row.key] ?? ''}
                    onChange={(event) => setReasons((current) => ({ ...current, [row.key]: event.target.value }))}
                    placeholder="Why this is changing"
                  />
                </div>
              </div>
              <div className="form-actions">
                <button className="btn btn-sm" type="button" disabled={savingKey === row.key} onClick={() => void save(row)}>
                  {savingKey === row.key ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MaintenancePage() {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad<{
    enabled: boolean;
    title: string;
    message: string;
    allowAdmin: boolean;
  }>('/admin/system/maintenance');
  const [title, setTitle] = useState("We'll be back soon");
  const [message, setMessage] = useState('DayFax is temporarily unavailable.');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.title) setTitle(data.title);
    if (data?.message) setMessage(data.message);
  }, [data]);

  async function save(enabled: boolean) {
    if (reason.trim().length < 3) {
      toast.push('Add a reason', 'error');
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/admin/system/maintenance', {
        method: 'PUT',
        body: JSON.stringify({
          enabled,
          title,
          message,
          allowAdmin: true,
          reason: reason.trim(),
        }),
      });
      toast.push(enabled ? 'Maintenance is on' : 'Maintenance is off', 'success');
      setReason('');
      await reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Maintenance</h1>
          <p>Customers see a blocking screen. Admin and health checks stay available.</p>
        </div>
      </div>
      <PageState loading={loading} error={error} />
      {!loading && !error ? (
        <div className="card stack">
          <p>
            Status:{' '}
            {data?.enabled ? <span className="badge badge-warn">On</span> : <span className="badge">Off</span>}
          </p>
          <div className="field">
            <label htmlFor="maint-title">Title</label>
            <input id="maint-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="maint-message">Message</label>
            <textarea id="maint-message" value={message} onChange={(event) => setMessage(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="maint-reason">Reason</label>
            <input id="maint-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" type="button" disabled={saving} onClick={() => void save(false)}>Turn off</button>
            <button className="btn btn-danger" type="button" disabled={saving} onClick={() => void save(true)}>Turn on</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ControlsPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad<Control[]>('/admin/system/controls');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(row: Control) {
    if (reason.trim().length < 3) {
      toast.push('Add a reason before changing a control', 'error');
      return;
    }
    setBusy(row.code);
    try {
      await apiRequest(`/admin/system/controls/${row.code}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !row.enabled, reason: reason.trim() }),
      });
      toast.push('Control updated', 'success');
      setReason('');
      await reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Emergency controls</h1>
          <p>
            Stop new orders, payments, or sign-in without deploying the app. Add a reason first.
            Disabling OTP login (customer) hides OTP in the app; customers without a password cannot
            sign in until OTP is on again or they set a password in Profile. Delivery partners can
            still use OTP.
          </p>
        </div>
      </div>
      <PageState loading={loading} error={error} />
      {!loading && !error ? (
        <div className="stack">
          <div className="card">
            <div className="field">
              <label htmlFor="control-reason">Reason for the next change</label>
              <input id="control-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why this is being switched" />
            </div>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Control</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((row) => (
                  <tr key={row.code}>
                    <td>
                      <strong>{controlLabel(row.code)}</strong>
                      {row.reason ? <div className="muted">{row.reason}</div> : null}
                    </td>
                    <td>{row.enabled ? <span className="badge">On</span> : <span className="badge badge-danger">Off</span>}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" type="button" disabled={busy === row.code} onClick={() => void toggle(row)}>
                        {row.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AnnouncementsPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad<Announcement[]>('/admin/system/announcements');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'INFO' | 'WARNING' | 'CRITICAL'>('INFO');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/admin/system/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title,
          message,
          severity,
          dismissible: severity !== 'CRITICAL',
          platform: 'ALL',
          isActive: true,
          reason: 'announcement',
        }),
      });
      toast.push('Announcement published', 'success');
      setTitle('');
      setMessage('');
      await reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(row: Announcement) {
    setBusyId(row.id);
    try {
      await apiRequest(`/admin/system/announcements/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      toast.push(row.isActive ? 'Announcement deactivated' : 'Announcement activated', 'success');
      await reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: Announcement) {
    if (!window.confirm(`Delete “${row.title}”? It will disappear from the customer app.`)) {
      return;
    }
    setBusyId(row.id);
    try {
      await apiRequest(`/admin/system/announcements/${row.id}`, { method: 'DELETE' });
      toast.push('Announcement deleted', 'success');
      await reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  const items = data ?? [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Announcements</h1>
          <p>A short banner at the top of the customer app. Critical messages cannot be dismissed.</p>
        </div>
      </div>
      <form className="card stack" onSubmit={(event) => void save(event)}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="ann-title">Title</label>
            <input id="ann-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="ann-severity">Severity</label>
            <select id="ann-severity" value={severity} onChange={(event) => setSeverity(event.target.value as 'INFO' | 'WARNING' | 'CRITICAL')}>
              <option value="INFO">Info</option>
              <option value="WARNING">Warning</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="ann-message">Message</label>
          <textarea id="ann-message" value={message} onChange={(event) => setMessage(event.target.value)} required />
        </div>
        <div className="form-actions">
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Publishing…' : 'Publish'}</button>
        </div>
      </form>
      <div className="section-gap">
        <PageState loading={loading} error={error} empty={!loading && !error && items.length === 0 ? 'No announcements yet.' : undefined} />
        {!loading && !error && items.length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Announcement</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.title}</strong>
                      <div className="muted">{row.message}</div>
                    </td>
                    <td>{row.severity}</td>
                    <td>{row.isActive ? <span className="badge">Active</span> : <span className="badge badge-muted">Off</span>}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === row.id}
                          onClick={() => void toggle(row)}
                        >
                          {row.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={busyId === row.id}
                          onClick={() => void remove(row)}
                        >
                          Delete
                        </button>
                      </div>
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

export function AuditLogsPage() {
  const { data, error, loading } = useLoad<{ items: AuditItem[] }>('/admin/system/audit-logs?limit=50');
  const items = data?.items ?? [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Audit logs</h1>
          <p>Recent administrative changes. History cannot be edited here.</p>
        </div>
      </div>
      <PageState loading={loading} error={error} empty={!loading && !error && items.length === 0 ? 'No audit events yet.' : undefined} />
      {!loading && !error && items.length > 0 ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Module</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>{formatWhen(row.created_at)}</td>
                  <td>{row.action.replaceAll('_', ' ')}</td>
                  <td>{row.module}</td>
                  <td>{row.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export function SystemHealthPage() {
  const { data, error, loading, reload } = useLoad<Health>('/admin/system/health');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>System health</h1>
          <p>A light check of the API, database, and recent webhook failures.</p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={() => void reload()}>Refresh</button>
      </div>
      <PageState loading={loading} error={error} />
      {!loading && !error && data ? (
        <div className="grid-stats">
          <div className="card stat">
            <span>API</span>
            <strong>{data.api}</strong>
          </div>
          <div className="card stat">
            <span>Database</span>
            <strong>{data.database}</strong>
          </div>
          <div className="card stat">
            <span>Database time</span>
            <strong>{data.databaseMs} ms</strong>
          </div>
          <div className="card stat">
            <span>Failed webhooks, 24h</span>
            <strong>{data.failedWebhooks24h}</strong>
          </div>
          <div className="card stat">
            <span>Payments</span>
            <strong>{data.razorpayConfigured ? 'Ready' : 'Off'}</strong>
          </div>
          <div className="card stat">
            <span>Push</span>
            <strong>{data.pushConfigured ? 'Ready' : 'Off'}</strong>
          </div>
        </div>
      ) : null}
    </div>
  );
}
