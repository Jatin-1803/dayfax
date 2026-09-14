import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, apiRequest } from '../api/client';
import type {
  AdminHomeCollection,
  AdminHomeCollectionItem,
  CatalogProduct,
  HomeCollectionAvailability,
  HomeCollectionStatus,
} from '../api/types';
import { resolvePublicUrl } from '../components/FormFields';
import { useToast } from '../components/Toast';

type PickedProduct = {
  productId: string;
  name: string;
  imageUrl: string | null;
  availability: HomeCollectionAvailability | null;
};

type CollectionForm = {
  headline: string;
  headlineHi: string;
  priority: string;
  isActive: boolean;
  startAt: string;
  endAt: string;
  products: PickedProduct[];
};

const MAX_PRODUCTS = 24;

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
  end.setDate(end.getDate() + 14);
  return {
    startAt: toDateTimeLocal(start.toISOString()),
    endAt: toDateTimeLocal(end.toISOString()),
  };
}

function emptyForm(): CollectionForm {
  return {
    headline: '',
    headlineHi: '',
    priority: '0',
    isActive: true,
    products: [],
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

function statusLabel(status: HomeCollectionStatus) {
  switch (status) {
    case 'live':
      return 'Live';
    case 'scheduled':
      return 'Scheduled';
    case 'expired':
      return 'Expired';
    default:
      return 'Disabled';
  }
}

function availabilityLabel(availability: HomeCollectionAvailability | null) {
  switch (availability) {
    case 'in_stock':
      return 'In stock';
    case 'out_of_stock':
      return 'Out of stock — hidden on Home';
    case 'unavailable':
      return 'Unavailable — hidden on Home';
    case 'inactive':
      return 'Inactive — hidden on Home';
    case 'deleted':
      return 'Deleted — hidden on Home';
    default:
      return null;
  }
}

function fromItem(item: AdminHomeCollectionItem): PickedProduct {
  return {
    productId: item.productId,
    name: item.name ?? 'Missing product',
    imageUrl: item.imageUrl,
    availability: item.availability,
  };
}

export function HomeCollectionsPage() {
  const toast = useToast();
  const [collections, setCollections] = useState<AdminHomeCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CollectionForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState('');
  const [productSearching, setProductSearching] = useState(false);
  const [productResults, setProductResults] = useState<CatalogProduct[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setCollections(await apiRequest<AdminHomeCollection[]>('/admin/home-collections'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collections');
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
    setProductQuery('');
    setProductResults([]);
    setOpen(true);
  }

  function openEdit(collection: AdminHomeCollection) {
    setEditingId(collection.id);
    setForm({
      headline: collection.headline,
      headlineHi: collection.headlineHi ?? '',
      priority: String(collection.priority),
      isActive: collection.isActive,
      startAt: toDateTimeLocal(collection.startAt),
      endAt: toDateTimeLocal(collection.endAt),
      products: collection.items.map(fromItem),
    });
    setProductQuery('');
    setProductResults([]);
    setOpen(true);
  }

  function moveProduct(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    setForm((current) => {
      if (nextIndex < 0 || nextIndex >= current.products.length) return current;
      const products = [...current.products];
      const [moved] = products.splice(index, 1);
      if (!moved) return current;
      products.splice(nextIndex, 0, moved);
      return { ...current, products };
    });
  }

  function removeProduct(productId: string) {
    setForm((current) => ({
      ...current,
      products: current.products.filter((item) => item.productId !== productId),
    }));
  }

  function addProduct(product: CatalogProduct) {
    setForm((current) => {
      if (current.products.some((item) => item.productId === product.id)) {
        toast.push('That product is already in this collection', 'info');
        return current;
      }
      if (current.products.length >= MAX_PRODUCTS) {
        toast.push(`A collection can include up to ${MAX_PRODUCTS} products`, 'error');
        return current;
      }
      return {
        ...current,
        products: [
          ...current.products,
          {
            productId: product.id,
            name: product.name,
            imageUrl: product.imageUrl,
            availability: product.defaultVariant?.inStock ? 'in_stock' : 'out_of_stock',
          },
        ],
      };
    });
    setProductResults([]);
    setProductQuery('');
  }

  async function onSearchProducts() {
    const q = productQuery.trim();
    if (!q) return;
    setProductSearching(true);
    try {
      const data = await apiRequest<{ items: CatalogProduct[] }>(
        `/products?q=${encodeURIComponent(q)}&limit=20&lang=en`,
      );
      setProductResults(data.items);
      if (data.items.length === 0) {
        toast.push('No products found', 'info');
      }
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Search failed', 'error');
      setProductResults([]);
    } finally {
      setProductSearching(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const headline = form.headline.trim();
    if (!headline) {
      toast.push('Add a headline', 'error');
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
    if (form.products.length === 0) {
      toast.push('Add at least one product', 'error');
      return;
    }

    const payload = {
      headline,
      headlineHi: form.headlineHi.trim() || null,
      priority,
      isActive: form.isActive,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      productIds: form.products.map((item) => item.productId),
    };

    setSaving(true);
    try {
      if (editingId) {
        await apiRequest(`/admin/home-collections/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.push('Collection updated', 'success');
      } else {
        await apiRequest('/admin/home-collections', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.push('Collection created', 'success');
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function onToggle(collection: AdminHomeCollection) {
    setBusyId(collection.id);
    try {
      await apiRequest(`/admin/home-collections/${collection.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !collection.isActive }),
      });
      toast.push(collection.isActive ? 'Collection disabled' : 'Collection enabled', 'success');
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(collection: AdminHomeCollection) {
    if (!window.confirm(`Delete “${collection.headline}”? It will disappear from the home screen.`)) {
      return;
    }
    setBusyId(collection.id);
    try {
      await apiRequest(`/admin/home-collections/${collection.id}`, { method: 'DELETE' });
      toast.push('Collection deleted', 'success');
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
          <h1>Home collections</h1>
          <p>Festival items shown above Popular Local Shops. Only the live, highest-priority collection is visible.</p>
        </div>
        <button type="button" className="btn" onClick={openCreate}>
          Add collection
        </button>
      </div>

      {loading ? <div className="loading-box">Loading collections…</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      {!loading && !error && collections.length === 0 ? (
        <div className="empty card">No collections yet. Add one to feature festival items on Home.</div>
      ) : null}

      {!loading && collections.length > 0 ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Collection</th>
                <th>Schedule</th>
                <th>Priority</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {collections.map((collection) => (
                <tr key={collection.id}>
                  <td>
                    <strong>{collection.headline}</strong>
                    <div className="muted">
                      {collection.items.length} product{collection.items.length === 1 ? '' : 's'}
                      {collection.isLiveWinner ? ' · Showing on Home' : ''}
                    </div>
                  </td>
                  <td>
                    {formatWhen(collection.startAt)}
                    <div className="muted">to {formatWhen(collection.endAt)}</div>
                  </td>
                  <td>{collection.priority}</td>
                  <td>
                    <span className={collection.status === 'live' ? 'badge' : 'badge badge-muted'}>
                      {statusLabel(collection.status)}
                    </span>
                    {collection.isLiveWinner ? (
                      <div className="muted">Live winner</div>
                    ) : null}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busyId === collection.id}
                        onClick={() => openEdit(collection)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busyId === collection.id}
                        onClick={() => void onToggle(collection)}
                      >
                        {collection.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={busyId === collection.id}
                        onClick={() => void onDelete(collection)}
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
            <h2>{editingId ? 'Edit collection' : 'Add collection'}</h2>
            <div className="stack">
              <div className="form-grid">
                <div className="field">
                  <label>Headline</label>
                  <input
                    value={form.headline}
                    onChange={(event) => setForm({ ...form, headline: event.target.value })}
                    required
                    maxLength={120}
                    placeholder="Holi specials"
                  />
                </div>
                <div className="field">
                  <label>Hindi headline</label>
                  <input
                    value={form.headlineHi}
                    onChange={(event) => setForm({ ...form, headlineHi: event.target.value })}
                    maxLength={120}
                    placeholder="होली स्पेशल"
                  />
                </div>
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
              <p className="muted">
                If two collections overlap, the higher priority is shown. If priority is the same, the newer one wins.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                />{' '}
                Enabled
              </label>

              <div className="field">
                <label>Products</label>
                <div className="row-actions">
                  <input
                    value={productQuery}
                    onChange={(event) => setProductQuery(event.target.value)}
                    placeholder="Search catalog"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void onSearchProducts();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={productSearching || !productQuery.trim()}
                    onClick={() => void onSearchProducts()}
                  >
                    {productSearching ? 'Searching…' : 'Search'}
                  </button>
                </div>
              </div>

              {productResults.length > 0 ? (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {productResults.map((product) => (
                        <tr key={product.id}>
                          <td>
                            <strong>{product.name}</strong>
                            <div className="muted">{product.store.name}</div>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => addProduct(product)}
                            >
                              Add
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {form.products.length === 0 ? (
                <p className="muted">No products yet. Search and add up to {MAX_PRODUCTS}.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <tbody>
                      {form.products.map((product, index) => {
                        const note =
                        product.availability && product.availability !== 'in_stock'
                          ? availabilityLabel(product.availability)
                          : null;
                        return (
                          <tr key={product.productId}>
                            <td>
                              <div className="image-preview-row">
                                {product.imageUrl ? (
                                  <img
                                    src={resolvePublicUrl(product.imageUrl) || ''}
                                    alt=""
                                    className="image-thumb"
                                  />
                                ) : null}
                                <div>
                                  <strong>
                                    {index + 1}. {product.name}
                                  </strong>
                                  {note ? <div className="muted">{note}</div> : null}
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  disabled={index === 0}
                                  onClick={() => moveProduct(index, -1)}
                                >
                                  Up
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  disabled={index === form.products.length - 1}
                                  onClick={() => moveProduct(index, 1)}
                                >
                                  Down
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => removeProduct(product.productId)}
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
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
