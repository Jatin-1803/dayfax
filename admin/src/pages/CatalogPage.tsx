import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, ApiError, formatPaise } from '../api/client';
import type { AdminStore, CatalogProduct, Category, PaginationMeta } from '../api/types';
import { useToast } from '../components/Toast';
import { ImageUploadField, MoneyInput, resolvePublicUrl, rupeesToPaise } from '../components/FormFields';

function orderedCategories(categories: Category[]): Category[] {
  const parents = categories
    .filter((category) => !category.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const ordered: Category[] = [];
  const seen = new Set<string>();
  for (const parent of parents) {
    ordered.push(parent);
    seen.add(parent.id);
    const children = categories
      .filter((category) => category.parentId === parent.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    for (const child of children) {
      ordered.push(child);
      seen.add(child.id);
    }
  }
  for (const category of categories) {
    if (!seen.has(category.id)) ordered.push(category);
  }
  return ordered;
}

function emptyCreateProductForm() {
  return {
    storeId: '',
    categoryId: '',
    name: '',
    nameHi: '',
    description: '',
    descriptionHi: '',
    brand: '',
    subCategory: '',
    subCategoryHi: '',
    unitLabel: '1 pc',
    priceRupees: '',
    mrpRupees: '',
    quantityAvailable: '100',
    imageUrl: null as string | null,
    isAvailable: true,
  };
}

interface AdminProductDetail {
  id: string;
  categoryId: string;
  name: string;
  nameHi: string | null;
  slug: string;
  description: string | null;
  descriptionHi: string | null;
  brand: string | null;
  subCategory: string | null;
  subCategoryHi: string | null;
  imageUrl: string | null;
  isActive: boolean;
  storeId: string | null;
  defaultVariant: {
    id: string;
    unitLabel: string;
    pricePaise: number;
    mrpPaise: number;
    quantityAvailable: number;
  } | null;
}

export function CatalogPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'categories' | 'products'>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catForm, setCatForm] = useState({
    name: '',
    nameHi: '',
    sortOrder: '0',
    iconKey: '',
    imageUrl: null as string | null,
    isActive: true,
  });
  const [editProduct, setEditProduct] = useState<AdminProductDetail | null>(null);
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [createProdForm, setCreateProdForm] = useState(emptyCreateProductForm);
  const [prodForm, setProdForm] = useState({
    name: '',
    nameHi: '',
    description: '',
    descriptionHi: '',
    brand: '',
    subCategory: '',
    subCategoryHi: '',
    imageUrl: null as string | null,
    isActive: true,
  });

  async function loadCategories() {
    const data = await apiRequest<Category[]>(
      '/categories?includeInactive=true&includeChildren=true&lang=en',
    );
    setCategories(data);
  }

  async function loadProducts(nextPage = page, search = q) {
    const params = new URLSearchParams({
      lang: 'en',
      limit: '20',
      page: String(nextPage),
    });
    if (search.trim()) params.set('q', search.trim());
    const data = await apiRequest<{ items: CatalogProduct[]; pagination: PaginationMeta }>(
      `/products?${params}`,
    );
    setProducts(data.items);
    setPagination(data.pagination);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadCategories(), loadProducts(1, '')]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function openEditCategory(c: Category) {
    try {
      // Public list may omit nameHi; fetch patch target fields from list + keep known
      setEditCategory(c);
      setCatForm({
        name: c.name,
        nameHi: c.nameHi || '',
        sortOrder: String(c.sortOrder),
        iconKey: c.iconKey || '',
        imageUrl: c.imageUrl,
        isActive: c.isActive,
      });
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Failed', 'error');
    }
  }

  async function openEditProduct(p: CatalogProduct) {
    try {
      const detail = await apiRequest<AdminProductDetail>(`/admin/catalog/products/${p.id}`);
      setEditProduct(detail);
      setProdForm({
        name: detail.name,
        nameHi: detail.nameHi || '',
        description: detail.description || '',
        descriptionHi: detail.descriptionHi || '',
        brand: detail.brand || '',
        subCategory: detail.subCategory || '',
        subCategoryHi: detail.subCategoryHi || '',
        imageUrl: detail.imageUrl,
        isActive: detail.isActive,
      });
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed to load product', 'error');
    }
  }

  async function onCreateCategory(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/admin/catalog/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: catForm.name,
          nameHi: catForm.nameHi || null,
          sortOrder: Number(catForm.sortOrder) || 0,
          iconKey: catForm.iconKey || null,
          imageUrl: catForm.imageUrl,
        }),
      });
      toast.push('Category created', 'success');
      setCreateOpen(false);
      setCatForm({
        name: '',
        nameHi: '',
        sortOrder: '0',
        iconKey: '',
        imageUrl: null,
        isActive: true,
      });
      await loadCategories();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Create failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveCategory(e: FormEvent) {
    e.preventDefault();
    if (!editCategory) return;
    setSaving(true);
    try {
      await apiRequest(`/admin/catalog/categories/${editCategory.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: catForm.name,
          nameHi: catForm.nameHi || null,
          sortOrder: Number(catForm.sortOrder) || 0,
          iconKey: catForm.iconKey || null,
          imageUrl: catForm.imageUrl,
          isActive: catForm.isActive,
        }),
      });
      toast.push('Category updated', 'success');
      setEditCategory(null);
      await loadCategories();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function openCreateProduct() {
    setCreateProdForm({
      ...emptyCreateProductForm(),
      categoryId: categories[0]?.id ?? '',
    });
    setCreateProductOpen(true);
    setStoresLoading(true);
    try {
      const list = await apiRequest<AdminStore[]>('/admin/stores');
      const active = list.filter((store) => store.isActive);
      const options = active.length > 0 ? active : list;
      setStores(options);
      setCreateProdForm((current) => ({
        ...current,
        storeId: current.storeId || options[0]?.id || '',
        categoryId: current.categoryId || categories[0]?.id || '',
      }));
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Failed to load stores', 'error');
    } finally {
      setStoresLoading(false);
    }
  }

  async function onCreateProduct(e: FormEvent) {
    e.preventDefault();
    if (!createProdForm.storeId) {
      toast.push('Select a store', 'error');
      return;
    }
    if (!createProdForm.categoryId) {
      toast.push('Select a category', 'error');
      return;
    }
    const pricePaise = rupeesToPaise(createProdForm.priceRupees);
    if (!Number.isFinite(pricePaise) || pricePaise <= 0) {
      toast.push('Enter a valid selling price', 'error');
      return;
    }
    const mrpPaise = createProdForm.mrpRupees
      ? rupeesToPaise(createProdForm.mrpRupees)
      : pricePaise;
    if (!Number.isFinite(mrpPaise) || mrpPaise <= 0) {
      toast.push('Enter a valid MRP', 'error');
      return;
    }
    setSaving(true);
    try {
      const created = await apiRequest<{ id: string }>('/admin/stores/products', {
        method: 'POST',
        body: JSON.stringify({
          storeId: createProdForm.storeId,
          categoryId: createProdForm.categoryId,
          name: createProdForm.name,
          nameHi: createProdForm.nameHi || null,
          description: createProdForm.description || null,
          descriptionHi: createProdForm.descriptionHi || null,
          brand: createProdForm.brand || null,
          unitLabel: createProdForm.unitLabel.trim() || '1 pc',
          pricePaise,
          mrpPaise,
          quantityAvailable: Number(createProdForm.quantityAvailable) || 0,
          imageUrl: createProdForm.imageUrl,
          isAvailable: createProdForm.isAvailable,
        }),
      });
      if (createProdForm.subCategory.trim() || createProdForm.subCategoryHi.trim()) {
        try {
          await apiRequest(`/admin/catalog/products/${created.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              subCategory: createProdForm.subCategory || null,
              subCategoryHi: createProdForm.subCategoryHi || null,
            }),
          });
        } catch {
          toast.push('Product created, but subcategory could not be saved', 'error');
          setCreateProductOpen(false);
          setCreateProdForm(emptyCreateProductForm());
          setPage(1);
          await loadProducts(1, q);
          return;
        }
      }
      toast.push('Product created', 'success');
      setCreateProductOpen(false);
      setCreateProdForm(emptyCreateProductForm());
      setPage(1);
      await loadProducts(1, q);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Create failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveProduct(e: FormEvent) {
    e.preventDefault();
    if (!editProduct) return;
    setSaving(true);
    try {
      await apiRequest(`/admin/catalog/products/${editProduct.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: prodForm.name,
          nameHi: prodForm.nameHi || null,
          description: prodForm.description || null,
          descriptionHi: prodForm.descriptionHi || null,
          brand: prodForm.brand || null,
          subCategory: prodForm.subCategory || null,
          subCategoryHi: prodForm.subCategoryHi || null,
          imageUrl: prodForm.imageUrl,
          isActive: prodForm.isActive,
        }),
      });
      toast.push('Product updated', 'success');
      setEditProduct(null);
      await loadProducts(page, q);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Catalog</h1>
          <p>Bilingual categories and products. Pricing/stock is edited on the store product.</p>
        </div>
        {tab === 'products' ? (
          <button type="button" className="btn" onClick={() => void openCreateProduct()}>
            New product
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setCatForm({
                name: '',
                nameHi: '',
                sortOrder: '0',
                iconKey: '',
                imageUrl: null,
                isActive: true,
              });
              setCreateOpen(true);
            }}
          >
            New category
          </button>
        )}
      </div>

      <div className="toolbar">
        <button
          type="button"
          className={`btn btn-sm ${tab === 'categories' ? '' : 'btn-secondary'}`}
          onClick={() => setTab('categories')}
        >
          Categories
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'products' ? '' : 'btn-secondary'}`}
          onClick={() => setTab('products')}
        >
          Products
        </button>
        {tab === 'products' ? (
          <>
            <input placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setPage(1);
                void loadProducts(1, q);
              }}
            >
              Search
            </button>
          </>
        ) : null}
      </div>

      {loading ? <div className="loading-box">Loading…</div> : null}
      {error ? <div className="error-box">{error}</div> : null}

      {!loading && !error && tab === 'categories' ? (
        categories.length === 0 ? (
          <div className="empty card">No categories yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Parent</th>
                  <th>Slug</th>
                  <th>Sort</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orderedCategories(categories).map((c) => {
                  const parent = c.parentId
                    ? categories.find((item) => item.id === c.parentId)
                    : null;
                  return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {c.imageUrl ? (
                          <img
                            src={resolvePublicUrl(c.imageUrl) || ''}
                            alt=""
                            className="image-thumb-sm"
                          />
                        ) : null}
                        <strong style={c.parentId ? { paddingLeft: '1rem' } : undefined}>
                          {c.name}
                        </strong>
                      </div>
                    </td>
                    <td>{parent?.name ?? '—'}</td>
                    <td>{c.slug}</td>
                    <td>{c.sortOrder}</td>
                    <td>
                      {c.isActive ? (
                        <span className="badge">Active</span>
                      ) : (
                        <span className="badge badge-muted">Inactive</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void openEditCategory(c)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {!loading && !error && tab === 'products' ? (
        products.length === 0 ? (
          <div className="empty card">No products found.</div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Store</th>
                    <th>Price</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {p.imageUrl ? (
                            <img
                              src={resolvePublicUrl(p.imageUrl) || ''}
                              alt=""
                              className="image-thumb-sm"
                            />
                          ) : null}
                          <div>
                            <strong>{p.name}</strong>
                            <div className="muted">{p.category?.name}</div>
                          </div>
                        </div>
                      </td>
                      <td>{p.store?.name}</td>
                      <td>
                        {p.defaultVariant ? formatPaise(p.defaultVariant.pricePaise) : '—'}
                      </td>
                      <td className="row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => void openEditProduct(p)}
                        >
                          Edit
                        </button>
                        {p.store?.id ? (
                          <Link className="btn btn-ghost btn-sm" to={`/stores/${p.store.id}`}>
                            Pricing
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination ? (
              <div className="toolbar" style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!pagination.hasPreviousPage}
                  onClick={() => {
                    const next = page - 1;
                    setPage(next);
                    void loadProducts(next, q);
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
                    void loadProducts(next, q);
                  }}
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )
      ) : null}

      {createOpen ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>New category</h2>
            <form className="stack" onSubmit={onCreateCategory}>
              <div className="field">
                <label>Name (EN)</label>
                <input
                  required
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Name (HI)</label>
                <input
                  value={catForm.nameHi}
                  onChange={(e) => setCatForm({ ...catForm, nameHi: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Icon key</label>
                <input
                  value={catForm.iconKey}
                  onChange={(e) => setCatForm({ ...catForm, iconKey: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Sort order</label>
                <input
                  type="number"
                  value={catForm.sortOrder}
                  onChange={(e) => setCatForm({ ...catForm, sortOrder: e.target.value })}
                />
              </div>
              <ImageUploadField
                label="Category image"
                value={catForm.imageUrl}
                onChange={(imageUrl) => setCatForm({ ...catForm, imageUrl })}
                crop="circle"
              />
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

      {editCategory ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Edit category</h2>
            <form className="stack" onSubmit={onSaveCategory}>
              <div className="field">
                <label>Name (EN)</label>
                <input
                  required
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Name (HI)</label>
                <input
                  value={catForm.nameHi}
                  onChange={(e) => setCatForm({ ...catForm, nameHi: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Icon key</label>
                <input
                  value={catForm.iconKey}
                  onChange={(e) => setCatForm({ ...catForm, iconKey: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Sort order</label>
                <input
                  type="number"
                  value={catForm.sortOrder}
                  onChange={(e) => setCatForm({ ...catForm, sortOrder: e.target.value })}
                />
              </div>
              <ImageUploadField
                label="Category image"
                value={catForm.imageUrl}
                onChange={(imageUrl) => setCatForm({ ...catForm, imageUrl })}
                crop="circle"
              />
              <label>
                <input
                  type="checkbox"
                  checked={catForm.isActive}
                  onChange={(e) => setCatForm({ ...catForm, isActive: e.target.checked })}
                />{' '}
                Active
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditCategory(null)}>
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

      {createProductOpen ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>New product</h2>
            <p className="muted">Creates a catalog product and links it to a store with price and stock.</p>
            <form className="stack" onSubmit={onCreateProduct}>
              <div className="form-grid">
                <div className="field">
                  <label>Store</label>
                  <select
                    required
                    value={createProdForm.storeId}
                    disabled={storesLoading}
                    onChange={(e) => setCreateProdForm({ ...createProdForm, storeId: e.target.value })}
                  >
                    <option value="">{storesLoading ? 'Loading stores…' : 'Select store'}</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                        {store.isActive ? '' : ' (inactive)'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Category</label>
                  <select
                    required
                    value={createProdForm.categoryId}
                    onChange={(e) =>
                      setCreateProdForm({ ...createProdForm, categoryId: e.target.value })
                    }
                  >
                    <option value="">Select category</option>
                    {orderedCategories(categories).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.parentId ? `— ${c.name}` : c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Name (EN)</label>
                  <input
                    required
                    value={createProdForm.name}
                    onChange={(e) => setCreateProdForm({ ...createProdForm, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Name (HI)</label>
                  <input
                    value={createProdForm.nameHi}
                    onChange={(e) => setCreateProdForm({ ...createProdForm, nameHi: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Brand</label>
                  <input
                    value={createProdForm.brand}
                    onChange={(e) => setCreateProdForm({ ...createProdForm, brand: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Unit label</label>
                  <input
                    required
                    value={createProdForm.unitLabel}
                    onChange={(e) =>
                      setCreateProdForm({ ...createProdForm, unitLabel: e.target.value })
                    }
                  />
                </div>
                <MoneyInput
                  label="Selling price (₹)"
                  required
                  min="0.01"
                  valueRupees={createProdForm.priceRupees}
                  onChange={(priceRupees) => setCreateProdForm({ ...createProdForm, priceRupees })}
                />
                <MoneyInput
                  label="MRP (₹)"
                  min="0.01"
                  valueRupees={createProdForm.mrpRupees}
                  onChange={(mrpRupees) => setCreateProdForm({ ...createProdForm, mrpRupees })}
                />
                <div className="field">
                  <label>Stock qty</label>
                  <input
                    type="number"
                    min="0"
                    value={createProdForm.quantityAvailable}
                    onChange={(e) =>
                      setCreateProdForm({ ...createProdForm, quantityAvailable: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Sub category (EN)</label>
                  <input
                    value={createProdForm.subCategory}
                    onChange={(e) =>
                      setCreateProdForm({ ...createProdForm, subCategory: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Sub category (HI)</label>
                  <input
                    value={createProdForm.subCategoryHi}
                    onChange={(e) =>
                      setCreateProdForm({ ...createProdForm, subCategoryHi: e.target.value })
                    }
                  />
                </div>
              </div>
              {!storesLoading && stores.length === 0 ? (
                <p className="muted">Create a store first, then add a product to it.</p>
              ) : null}
              <ImageUploadField
                label="Product image"
                value={createProdForm.imageUrl}
                onChange={(imageUrl) => setCreateProdForm({ ...createProdForm, imageUrl })}
                crop="square"
              />
              <div className="field">
                <label>Description (EN)</label>
                <textarea
                  value={createProdForm.description}
                  onChange={(e) =>
                    setCreateProdForm({ ...createProdForm, description: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Description (HI)</label>
                <textarea
                  value={createProdForm.descriptionHi}
                  onChange={(e) =>
                    setCreateProdForm({ ...createProdForm, descriptionHi: e.target.value })
                  }
                />
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={createProdForm.isAvailable}
                  onChange={(e) =>
                    setCreateProdForm({ ...createProdForm, isAvailable: e.target.checked })
                  }
                />{' '}
                Available in store
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCreateProductOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={saving || storesLoading || stores.length === 0}
                >
                  {saving ? 'Saving…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editProduct ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Edit product</h2>
            {editProduct.defaultVariant ? (
              <p className="muted">
                SP {formatPaise(editProduct.defaultVariant.pricePaise)} · MRP{' '}
                {formatPaise(editProduct.defaultVariant.mrpPaise)} · Stock{' '}
                {editProduct.defaultVariant.quantityAvailable}
                {editProduct.storeId ? (
                  <>
                    {' '}
                    · <Link to={`/stores/${editProduct.storeId}`}>Edit pricing/stock</Link>
                  </>
                ) : null}
              </p>
            ) : null}
            <form className="stack" onSubmit={onSaveProduct}>
              <div className="form-grid">
                <div className="field">
                  <label>Name (EN)</label>
                  <input
                    required
                    value={prodForm.name}
                    onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Name (HI)</label>
                  <input
                    value={prodForm.nameHi}
                    onChange={(e) => setProdForm({ ...prodForm, nameHi: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Brand</label>
                  <input
                    value={prodForm.brand}
                    onChange={(e) => setProdForm({ ...prodForm, brand: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Sub category (EN)</label>
                  <input
                    value={prodForm.subCategory}
                    onChange={(e) => setProdForm({ ...prodForm, subCategory: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Sub category (HI)</label>
                  <input
                    value={prodForm.subCategoryHi}
                    onChange={(e) => setProdForm({ ...prodForm, subCategoryHi: e.target.value })}
                  />
                </div>
              </div>
              <ImageUploadField
                label="Product image"
                value={prodForm.imageUrl}
                onChange={(imageUrl) => setProdForm({ ...prodForm, imageUrl })}
                crop="square"
              />
              <div className="field">
                <label>Description (EN)</label>
                <textarea
                  value={prodForm.description}
                  onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Description (HI)</label>
                <textarea
                  value={prodForm.descriptionHi}
                  onChange={(e) => setProdForm({ ...prodForm, descriptionHi: e.target.value })}
                />
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={prodForm.isActive}
                  onChange={(e) => setProdForm({ ...prodForm, isActive: e.target.checked })}
                />{' '}
                Active
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditProduct(null)}>
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
