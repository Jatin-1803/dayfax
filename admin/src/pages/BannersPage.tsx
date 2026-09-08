import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, apiRequest } from '../api/client';
import type { AdminBanner } from '../api/types';
import { ImageUploadField, resolvePublicUrl } from '../components/FormFields';
import { useToast } from '../components/Toast';

type BannerForm = {
  title: string;
  titleHi: string;
  imageUrl: string | null;
  linkPath: string;
  priority: string;
  isActive: boolean;
  startAt: string;
  endAt: string;
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toDateTimeLocal(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultWindow() {
  const start = new Date();
  start.setSeconds(0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  return {
    startAt: toDateTimeLocal(start.toISOString()),
    endAt: toDateTimeLocal(end.toISOString()),
  };
}

function emptyForm(): BannerForm {
  return {
    title: '',
    titleHi: '',
    imageUrl: null,
    linkPath: '',
    priority: '0',
    isActive: true,
    ...defaultWindow(),
  };
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

export function BannersPage() {
  const toast = useToast();
  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setBanners(await apiRequest<AdminBanner[]>('/admin/banners'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load banners');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(banner: AdminBanner) {
    setEditingId(banner.id);
    setForm({
      title: banner.title,
      titleHi: banner.titleHi ?? '',
      imageUrl: banner.imageUrl,
      linkPath: banner.linkPath ?? '',
      priority: String(banner.priority),
      isActive: banner.isActive,
      startAt: toDateTimeLocal(banner.startAt),
      endAt: toDateTimeLocal(banner.endAt),
    });
    setOpen(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.imageUrl) {
      toast.push('Upload a banner image', 'error');
      return;
    }
    const priority = Number(form.priority);
    if (!Number.isInteger(priority) || priority < 0 || priority > 1000) {
      toast.push('Priority must be a whole number from 0 to 1000', 'error');
      return;
    }
    if (!form.startAt || !form.endAt || new Date(form.endAt) <= new Date(form.startAt)) {
      toast.push('End time must be after start time', 'error');
      return;
    }

    const payload = {
      title: form.title.trim(),
      titleHi: form.titleHi.trim() || null,
      imageUrl: form.imageUrl,
      linkPath: form.linkPath.trim(),
      priority,
      isActive: form.isActive,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
    };

    setSaving(true);
    try {
      if (editingId) {
        await apiRequest(`/admin/banners/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.push('Banner updated', 'success');
      } else {
        await apiRequest('/admin/banners', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.push('Banner created', 'success');
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function onToggle(banner: AdminBanner) {
    setBusyId(banner.id);
    try {
      await apiRequest(`/admin/banners/${banner.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !banner.isActive }),
      });
      toast.push(banner.isActive ? 'Banner disabled' : 'Banner enabled', 'success');
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(banner: AdminBanner) {
    if (!window.confirm(`Delete “${banner.title}”? It will disappear from the home screen.`)) {
      return;
    }
    setBusyId(banner.id);
    try {
      await apiRequest(`/admin/banners/${banner.id}`, { method: 'DELETE' });
      toast.push('Banner deleted', 'success');
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Banners</h1>
          <p>Promotional images at the top of the customer home screen.</p>
        </div>
        <button type="button" className="btn" onClick={openCreate}>
          Add banner
        </button>
      </div>

      {loading ? <div className="loading-box">Loading banners…</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      {!loading && !error && banners.length === 0 ? (
        <div className="empty card">No banners yet. Create one to show on Home.</div>
      ) : null}

      {!loading && banners.length > 0 ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Banner</th>
                <th>Schedule</th>
                <th>Priority</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {banners.map((banner) => (
                <tr key={banner.id}>
                  <td>
                    <div className="image-preview-row">
                      <img
                        src={resolvePublicUrl(banner.imageUrl) || ''}
                        alt=""
                        className="image-thumb"
                      />
                      <div>
                        <strong>{banner.title}</strong>
                        <div className="muted">
                          {banner.linkPath ? banner.linkPath : 'Not clickable'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {formatWhen(banner.startAt)}
                    <div className="muted">to {formatWhen(banner.endAt)}</div>
                  </td>
                  <td>{banner.priority}</td>
                  <td>
                    {banner.isActive ? (
                      <span className="badge">Active</span>
                    ) : (
                      <span className="badge badge-muted">Inactive</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busyId === banner.id}
                        onClick={() => openEdit(banner)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busyId === banner.id}
                        onClick={() => void onToggle(banner)}
                      >
                        {banner.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={busyId === banner.id}
                        onClick={() => void onDelete(banner)}
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

      {open ? (
        <div className="modal-backdrop" onClick={() => !saving && setOpen(false)}>
          <form
            className="modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => void onSubmit(event)}
          >
            <h2>{editingId ? 'Edit banner' : 'Add banner'}</h2>
            <div className="stack">
              <div className="form-grid">
                <div className="field">
                  <label>Title</label>
                  <input
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    required
                    maxLength={120}
                  />
                </div>
                <div className="field">
                  <label>Hindi title</label>
                  <input
                    value={form.titleHi}
                    onChange={(event) => setForm({ ...form, titleHi: event.target.value })}
                    maxLength={120}
                  />
                </div>
              </div>
              <ImageUploadField
                label="Banner image"
                value={form.imageUrl}
                onChange={(imageUrl) => setForm({ ...form, imageUrl })}
                disabled={saving}
              />
              <p className="muted">
                Use a wide image, about 1440×600. JPEG, PNG, or WebP up to 2MB. The picture is the
                banner — title is for admin and accessibility.
              </p>
              <div className="field">
                <label>Link path (optional)</label>
                <input
                  value={form.linkPath}
                  onChange={(event) => setForm({ ...form, linkPath: event.target.value })}
                  placeholder="/categories"
                />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Start</label>
                  <input
                    type="datetime-local"
                    value={form.startAt}
                    onChange={(event) => setForm({ ...form, startAt: event.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label>End</label>
                  <input
                    type="datetime-local"
                    value={form.endAt}
                    onChange={(event) => setForm({ ...form, endAt: event.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="field">
                <label>Priority</label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={form.priority}
                  onChange={(event) => setForm({ ...form, priority: event.target.value })}
                  required
                />
              </div>
              <p className="muted">Higher priority is shown first when more than one banner is live.</p>
              <label>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                />{' '}
                Enabled
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
