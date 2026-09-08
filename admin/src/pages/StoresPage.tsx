import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiRequest, formatPaise, ApiError } from '../api/client';
import type { AdminStore, Category, StoreProduct } from '../api/types';
import { useToast } from '../components/Toast';
import {
  ImageUploadField,
  MoneyInput,
  paiseToRupees,
  resolvePublicUrl,
  rupeesToPaise,
} from '../components/FormFields';

const STORE_TYPES = ['FOOD', 'GROCERY', 'VEGETABLES', 'MIXED', 'OTHER'] as const;

const emptyStore = {
  name: '',
  storeType: 'FOOD' as (typeof STORE_TYPES)[number],
  phone: '',
  addressLine1: '',
  addressLine2: '',
  landmark: '',
  city: '',
  pincode: '',
  latitude: '',
  longitude: '',
  isPopular: true,
  isActive: true,
  description: '',
  imageUrl: null as string | null,
};

type ProductForm = {
  name: string;
  nameHi: string;
  description: string;
  descriptionHi: string;
  brand: string;
  unitLabel: string;
  priceRupees: string;
  mrpRupees: string;
  quantityAvailable: string;
  categoryId: string;
  imageUrl: string | null;
  isAvailable: boolean;
};

const emptyProductForm = (): ProductForm => ({
  name: '',
  nameHi: '',
  description: '',
  descriptionHi: '',
  brand: '',
  unitLabel: '1 pc',
  priceRupees: '',
  mrpRupees: '',
  quantityAvailable: '100',
  categoryId: '',
  imageUrl: null,
  isAvailable: true,
});

export function StoresPage() {
  const toast = useToast();
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyStore);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setStores(await apiRequest<AdminStore[]>('/admin/stores'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stores');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/admin/stores', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          storeType: form.storeType,
          phone: form.phone || null,
          phoneCountryCode: '+91',
          addressLine1: form.addressLine1 || null,
          addressLine2: form.addressLine2 || null,
          landmark: form.landmark || null,
          city: form.city || null,
          pincode: form.pincode || null,
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
          description: form.description || null,
          imageUrl: form.imageUrl,
          isPopular: form.isPopular,
          isActive: form.isActive,
        }),
      });
      toast.push('Store created', 'success');
      setShowCreate(false);
      setForm(emptyStore);
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Create failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Stores</h1>
          <p>Shops shown in the customer app.</p>
        </div>
        <button type="button" className="btn" onClick={() => setShowCreate(true)}>
          Add store
        </button>
      </div>

      {loading ? <div className="loading-box">Loading stores…</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      {!loading && !error && stores.length === 0 ? (
        <div className="empty card">No stores yet. Create the first shop.</div>
      ) : null}

      {!loading && stores.length > 0 ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>City</th>
                <th>Flags</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    <div className="muted">{s.phone ? `+91 ${s.phone}` : '—'}</div>
                  </td>
                  <td>{s.storeType}</td>
                  <td>{s.city || '—'}</td>
                  <td>
                    {s.isActive ? (
                      <span className="badge">Active</span>
                    ) : (
                      <span className="badge badge-muted">Inactive</span>
                    )}{' '}
                    {s.isPopular ? <span className="badge">Popular</span> : null}
                  </td>
                  <td>
                    <Link className="btn btn-secondary btn-sm" to={`/stores/${s.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {showCreate ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>New store</h2>
            <form className="stack" onSubmit={onCreate}>
              <div className="form-grid">
                <div className="field">
                  <label>Name</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Type</label>
                  <select
                    value={form.storeType}
                    onChange={(e) =>
                      setForm({ ...form, storeType: e.target.value as typeof form.storeType })
                    }
                  >
                    {STORE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input
                    value={form.phone}
                    maxLength={10}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
                    }
                  />
                </div>
                <div className="field">
                  <label>City</label>
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="field">
                  <label>Address</label>
                  <input
                    value={form.addressLine1}
                    onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Pincode</label>
                  <input
                    value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                  />
                </div>
              </div>
              <ImageUploadField
                label="Store image"
                value={form.imageUrl}
                onChange={(imageUrl) => setForm({ ...form, imageUrl })}
              />
              <div className="field">
                <label>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={form.isPopular}
                  onChange={(e) => setForm({ ...form, isPopular: e.target.checked })}
                />{' '}
                Popular
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />{' '}
                Active
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
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
    </div>
  );
}

export function StoreDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [store, setStore] = useState<AdminStore | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProduct, setShowProduct] = useState(false);
  const [editProduct, setEditProduct] = useState<StoreProduct | null>(null);
  const [editStore, setEditStore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm());
  const [storeForm, setStoreForm] = useState(emptyStore);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [s, p, cats] = await Promise.all([
        apiRequest<AdminStore>(`/admin/stores/${id}`),
        apiRequest<StoreProduct[]>(`/admin/stores/${id}/products`),
        apiRequest<Category[]>('/categories?includeInactive=true&lang=en'),
      ]);
      setStore(s);
      setProducts(p);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load store');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  function openStoreEdit() {
    if (!store) return;
    setStoreForm({
      name: store.name,
      storeType: store.storeType as (typeof STORE_TYPES)[number],
      phone: store.phone || '',
      addressLine1: store.addressLine1 || '',
      addressLine2: store.addressLine2 || '',
      landmark: store.landmark || '',
      city: store.city || '',
      pincode: store.pincode || '',
      latitude: store.latitude != null ? String(store.latitude) : '',
      longitude: store.longitude != null ? String(store.longitude) : '',
      isPopular: store.isPopular,
      isActive: store.isActive,
      description: store.description || '',
      imageUrl: store.imageUrl,
    });
    setEditStore(true);
  }

  async function onSaveStore(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      const updated = await apiRequest<AdminStore>(`/admin/stores/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: storeForm.name,
          storeType: storeForm.storeType,
          phone: storeForm.phone || null,
          addressLine1: storeForm.addressLine1 || null,
          addressLine2: storeForm.addressLine2 || null,
          landmark: storeForm.landmark || null,
          city: storeForm.city || null,
          pincode: storeForm.pincode || null,
          latitude: storeForm.latitude ? Number(storeForm.latitude) : null,
          longitude: storeForm.longitude ? Number(storeForm.longitude) : null,
          description: storeForm.description || null,
          imageUrl: storeForm.imageUrl,
          isPopular: storeForm.isPopular,
          isActive: storeForm.isActive,
        }),
      });
      setStore(updated);
      setEditStore(false);
      toast.push('Store updated', 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  function openCreateProduct() {
    const form = emptyProductForm();
    if (categories[0]) form.categoryId = categories[0].id;
    setProductForm(form);
    setEditProduct(null);
    setShowProduct(true);
  }

  function openEditProduct(p: StoreProduct) {
    setEditProduct(p);
    setProductForm({
      name: p.name,
      nameHi: p.nameHi || '',
      description: p.description || '',
      descriptionHi: p.descriptionHi || '',
      brand: p.brand || '',
      unitLabel: p.unitLabel || '1 pc',
      priceRupees: paiseToRupees(p.pricePaise),
      mrpRupees: paiseToRupees(p.mrpPaise ?? p.pricePaise),
      quantityAvailable: String(p.quantityAvailable),
      categoryId: p.categoryId || categories[0]?.id || '',
      imageUrl: p.imageUrl,
      isAvailable: p.isAvailable,
    });
    setShowProduct(true);
  }

  async function onSaveProduct(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      const pricePaise = rupeesToPaise(productForm.priceRupees);
      const mrpPaise = productForm.mrpRupees
        ? rupeesToPaise(productForm.mrpRupees)
        : pricePaise;
      if (editProduct) {
        await apiRequest(`/admin/stores/${id}/products/${editProduct.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: productForm.name,
            nameHi: productForm.nameHi || null,
            description: productForm.description || null,
            descriptionHi: productForm.descriptionHi || null,
            brand: productForm.brand || null,
            unitLabel: productForm.unitLabel,
            pricePaise,
            mrpPaise,
            quantityAvailable: Number(productForm.quantityAvailable) || 0,
            imageUrl: productForm.imageUrl,
            isAvailable: productForm.isAvailable,
          }),
        });
        toast.push('Product updated', 'success');
      } else {
        await apiRequest('/admin/stores/products', {
          method: 'POST',
          body: JSON.stringify({
            storeId: id,
            categoryId: productForm.categoryId || undefined,
            name: productForm.name,
            nameHi: productForm.nameHi || null,
            description: productForm.description || null,
            descriptionHi: productForm.descriptionHi || null,
            brand: productForm.brand || null,
            unitLabel: productForm.unitLabel,
            pricePaise,
            mrpPaise,
            quantityAvailable: Number(productForm.quantityAvailable) || 100,
            imageUrl: productForm.imageUrl,
            isAvailable: productForm.isAvailable,
          }),
        });
        toast.push('Product added', 'success');
      }
      setShowProduct(false);
      setEditProduct(null);
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading-box">Loading…</div>;
  if (error) return <div className="error-box">{error}</div>;
  if (!store) return <div className="empty">Store not found</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/stores')}>
            ← Stores
          </button>
          <h1>{store.name}</h1>
          <p>
            {store.storeType} · {store.city || 'No city'} · {store.slug}
          </p>
        </div>
        <div className="row-actions">
          <button type="button" className="btn btn-secondary" onClick={openStoreEdit}>
            Edit store
          </button>
          <button type="button" className="btn" onClick={openCreateProduct}>
            Add product
          </button>
        </div>
      </div>

      <div className="card">
        {store.imageUrl ? (
          <img
            src={resolvePublicUrl(store.imageUrl) || ''}
            alt=""
            className="image-thumb"
            style={{ marginBottom: '0.75rem' }}
          />
        ) : null}
        <p className="muted">{store.description || 'No description'}</p>
        <p>
          Phone: {store.phone ? `${store.phoneCountryCode} ${store.phone}` : '—'}
          <br />
          Address: {store.addressSummary || store.addressLine1 || '—'}
        </p>
      </div>

      <div className="page-header" style={{ marginTop: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem' }}>Products</h1>
          <p>{products.length} items linked to this store</p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="empty card">No products yet.</div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Product</th>
                <th>SP</th>
                <th>MRP</th>
                <th>Stock</th>
                <th>Available</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                      {p.imageUrl ? (
                        <img
                          src={resolvePublicUrl(p.imageUrl) || ''}
                          alt=""
                          className="image-thumb-sm"
                        />
                      ) : (
                        <span className="image-thumb-sm" />
                      )}
                      <div>
                        <strong>{p.name}</strong>
                        <div className="muted">{p.unitLabel}</div>
                      </div>
                    </div>
                  </td>
                  <td>{formatPaise(p.pricePaise)}</td>
                  <td>{formatPaise(p.mrpPaise ?? p.pricePaise)}</td>
                  <td>{p.quantityAvailable}</td>
                  <td>
                    {p.isAvailable ? (
                      <span className="badge">On</span>
                    ) : (
                      <span className="badge badge-muted">Off</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEditProduct(p)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editStore ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Edit store</h2>
            <form className="stack" onSubmit={onSaveStore}>
              <div className="form-grid">
                <div className="field">
                  <label>Name</label>
                  <input
                    required
                    value={storeForm.name}
                    onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Type</label>
                  <select
                    value={storeForm.storeType}
                    onChange={(e) =>
                      setStoreForm({
                        ...storeForm,
                        storeType: e.target.value as typeof storeForm.storeType,
                      })
                    }
                  >
                    {STORE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input
                    value={storeForm.phone}
                    maxLength={10}
                    onChange={(e) =>
                      setStoreForm({
                        ...storeForm,
                        phone: e.target.value.replace(/\D/g, '').slice(0, 10),
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>City</label>
                  <input
                    value={storeForm.city}
                    onChange={(e) => setStoreForm({ ...storeForm, city: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Address line 1</label>
                  <input
                    value={storeForm.addressLine1}
                    onChange={(e) => setStoreForm({ ...storeForm, addressLine1: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Address line 2</label>
                  <input
                    value={storeForm.addressLine2}
                    onChange={(e) => setStoreForm({ ...storeForm, addressLine2: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Landmark</label>
                  <input
                    value={storeForm.landmark}
                    onChange={(e) => setStoreForm({ ...storeForm, landmark: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Pincode</label>
                  <input
                    value={storeForm.pincode}
                    onChange={(e) => setStoreForm({ ...storeForm, pincode: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Latitude</label>
                  <input
                    value={storeForm.latitude}
                    onChange={(e) => setStoreForm({ ...storeForm, latitude: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Longitude</label>
                  <input
                    value={storeForm.longitude}
                    onChange={(e) => setStoreForm({ ...storeForm, longitude: e.target.value })}
                  />
                </div>
              </div>
              <ImageUploadField
                value={storeForm.imageUrl}
                onChange={(imageUrl) => setStoreForm({ ...storeForm, imageUrl })}
              />
              <div className="field">
                <label>Description</label>
                <textarea
                  value={storeForm.description}
                  onChange={(e) => setStoreForm({ ...storeForm, description: e.target.value })}
                />
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={storeForm.isPopular}
                  onChange={(e) => setStoreForm({ ...storeForm, isPopular: e.target.checked })}
                />{' '}
                Popular
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={storeForm.isActive}
                  onChange={(e) => setStoreForm({ ...storeForm, isActive: e.target.checked })}
                />{' '}
                Active
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditStore(false)}>
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

      {showProduct ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>{editProduct ? 'Edit product' : 'Add product'}</h2>
            <form className="stack" onSubmit={onSaveProduct}>
              <div className="form-grid">
                <div className="field">
                  <label>Name (EN)</label>
                  <input
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Name (HI)</label>
                  <input
                    value={productForm.nameHi}
                    onChange={(e) => setProductForm({ ...productForm, nameHi: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Category</label>
                  <select
                    required={!editProduct}
                    value={productForm.categoryId}
                    disabled={Boolean(editProduct)}
                    onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Unit label</label>
                  <input
                    value={productForm.unitLabel}
                    onChange={(e) => setProductForm({ ...productForm, unitLabel: e.target.value })}
                  />
                </div>
                <MoneyInput
                  label="Selling price (₹)"
                  required
                  min="0.01"
                  valueRupees={productForm.priceRupees}
                  onChange={(priceRupees) => setProductForm({ ...productForm, priceRupees })}
                />
                <MoneyInput
                  label="MRP (₹)"
                  min="0.01"
                  valueRupees={productForm.mrpRupees}
                  onChange={(mrpRupees) => setProductForm({ ...productForm, mrpRupees })}
                />
                <div className="field">
                  <label>Stock qty</label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.quantityAvailable}
                    onChange={(e) =>
                      setProductForm({ ...productForm, quantityAvailable: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Brand</label>
                  <input
                    value={productForm.brand}
                    onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                  />
                </div>
              </div>
              <ImageUploadField
                label="Product image"
                value={productForm.imageUrl}
                onChange={(imageUrl) => setProductForm({ ...productForm, imageUrl })}
                crop="square"
              />
              <div className="field">
                <label>Description (EN)</label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Description (HI)</label>
                <textarea
                  value={productForm.descriptionHi}
                  onChange={(e) =>
                    setProductForm({ ...productForm, descriptionHi: e.target.value })
                  }
                />
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={productForm.isAvailable}
                  onChange={(e) =>
                    setProductForm({ ...productForm, isAvailable: e.target.checked })
                  }
                />{' '}
                Available in store
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowProduct(false);
                    setEditProduct(null);
                  }}
                >
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
