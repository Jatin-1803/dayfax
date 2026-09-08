import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiRequest, ApiError } from '../api/client';
import type { CatalogProduct } from '../api/types';
import { useToast } from '../components/Toast';

interface SynonymTerm {
  id: string;
  term: string;
}

interface SynonymGroup {
  id: string;
  canonicalTerm: string;
  isActive: boolean;
  terms: SynonymTerm[];
}

interface ZeroResult {
  normalizedQ: string;
  sampleQ: string;
  hitCount: number;
  lastSeenAt: string;
}

export function SearchPage() {
  const toast = useToast();
  const [status, setStatus] = useState<{
    meilisearchEnabled: boolean;
    synonymGroups: number;
  } | null>(null);
  const [groups, setGroups] = useState<SynonymGroup[]>([]);
  const [zeroResults, setZeroResults] = useState<ZeroResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canonicalTerm, setCanonicalTerm] = useState('');
  const [termsText, setTermsText] = useState('');
  const [productId, setProductId] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<CatalogProduct[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [aliasesText, setAliasesText] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [st, gr, zr] = await Promise.all([
        apiRequest<{ meilisearchEnabled: boolean; synonymGroups: number }>(
          '/admin/search/status',
        ),
        apiRequest<SynonymGroup[]>('/admin/search/synonym-groups'),
        apiRequest<ZeroResult[]>('/admin/search/zero-results?limit=30&days=14'),
      ]);
      setStatus(st);
      setGroups(gr);
      setZeroResults(zr);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load search admin');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onReindex() {
    setBusy(true);
    try {
      const data = await apiRequest<{
        documentCount: number;
        synonymGroups: number;
        meilisearchEnabled: boolean;
      }>('/admin/search/reindex', { method: 'POST' });
      toast.push(
        `Reindexed ${data.documentCount} docs · ${data.synonymGroups} synonym groups`,
        'success',
      );
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Reindex failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateGroup(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const terms = termsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await apiRequest('/admin/search/synonym-groups', {
        method: 'POST',
        body: JSON.stringify({ canonicalTerm, terms, isActive: true }),
      });
      toast.push('Synonym group created', 'success');
      setCanonicalTerm('');
      setTermsText('');
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Create failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteGroup(id: string) {
    if (!window.confirm('Delete this synonym group?')) return;
    try {
      await apiRequest(`/admin/search/synonym-groups/${id}`, { method: 'DELETE' });
      toast.push('Deleted', 'success');
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    }
  }

  async function toggleGroup(group: SynonymGroup) {
    try {
      await apiRequest(`/admin/search/synonym-groups/${group.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !group.isActive }),
      });
      toast.push('Synonym group updated', 'success');
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Update failed', 'error');
    }
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

  function selectProduct(product: CatalogProduct) {
    setProductId(product.id);
    setProductResults([]);
    setProductQuery(product.name);
    toast.push('Product selected', 'info');
  }

  async function onLoadAliases() {
    if (!productId.trim()) return;
    try {
      const data = await apiRequest<{ productId: string; aliases: string[] }>(
        `/admin/products/${productId.trim()}/search-aliases`,
      );
      setAliasesText(data.aliases.join(', '));
      toast.push('Aliases loaded', 'info');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Load failed', 'error');
    }
  }

  async function onSaveAliases(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const aliases = aliasesText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await apiRequest(`/admin/products/${productId.trim()}/search-aliases`, {
        method: 'PUT',
        body: JSON.stringify({ aliases }),
      });
      toast.push('Aliases saved', 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Search</h1>
          <p>Synonyms, aliases, zero-result queries, and reindex.</p>
        </div>
        <button type="button" className="btn" disabled={busy} onClick={() => void onReindex()}>
          {busy ? 'Working…' : 'Reindex'}
        </button>
      </div>

      {loading ? <div className="loading-box">Loading…</div> : null}
      {error ? <div className="error-box">{error}</div> : null}

      {!loading && !error && status ? (
        <div className="grid-stats" style={{ marginBottom: '1rem' }}>
          <div className="card stat">
            <span>Meilisearch</span>
            <strong style={{ fontSize: '1.2rem' }}>
              {status.meilisearchEnabled ? 'Enabled' : 'Off'}
            </strong>
          </div>
          <div className="card stat">
            <span>Synonym groups</span>
            <strong>{status.synonymGroups}</strong>
          </div>
        </div>
      ) : null}

      <div className="card">
        <h2 style={{ marginTop: 0, fontFamily: 'var(--display)', fontSize: '1.25rem' }}>
          New synonym group
        </h2>
        <form className="stack" onSubmit={onCreateGroup}>
          <div className="form-grid">
            <div className="field">
              <label>Canonical term</label>
              <input
                required
                value={canonicalTerm}
                onChange={(e) => setCanonicalTerm(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Terms (comma-separated)</label>
              <input
                value={termsText}
                onChange={(e) => setTermsText(e.target.value)}
                placeholder="tomato, tamatar"
              />
            </div>
          </div>
          <button className="btn" type="submit" disabled={busy}>
            Create group
          </button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontFamily: 'var(--display)', fontSize: '1.25rem' }}>
          Synonym groups
        </h2>
        {groups.length === 0 ? (
          <div className="empty">No synonym groups.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Canonical</th>
                  <th>Terms</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <strong>{g.canonicalTerm}</strong>
                    </td>
                    <td>{g.terms.map((t) => t.term).join(', ') || '—'}</td>
                    <td>
                      {g.isActive ? (
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
                          onClick={() => void toggleGroup(g)}
                        >
                          {g.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => void onDeleteGroup(g.id)}
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
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontFamily: 'var(--display)', fontSize: '1.25rem' }}>
          Product search aliases
        </h2>
        <form className="stack" onSubmit={onSaveAliases}>
          <div className="field">
            <label>Search product</label>
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Product name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
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
            {productResults.length > 0 ? (
              <div className="table-wrap" style={{ marginTop: '0.5rem' }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Store</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {productResults.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name}</strong>
                          <div className="muted">{p.category.name}</div>
                        </td>
                        <td>{p.store.name}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => selectProduct(p)}
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Product ID</label>
              <input value={productId} onChange={(e) => setProductId(e.target.value)} required />
            </div>
            <div className="field">
              <label>Aliases (comma-separated)</label>
              <input value={aliasesText} onChange={(e) => setAliasesText(e.target.value)} />
            </div>
          </div>
          <div className="row-actions">
            <button type="button" className="btn btn-secondary" onClick={() => void onLoadAliases()}>
              Load
            </button>
            <button type="submit" className="btn" disabled={busy}>
              Save aliases
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontFamily: 'var(--display)', fontSize: '1.25rem' }}>
          Zero-result queries (14 days)
        </h2>
        {zeroResults.length === 0 ? (
          <div className="empty">No zero-result queries logged.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Hits logged</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {zeroResults.map((z) => (
                  <tr key={z.normalizedQ}>
                    <td>
                      <strong>{z.sampleQ}</strong>
                      <div className="muted">{z.normalizedQ}</div>
                    </td>
                    <td>{z.hitCount}</td>
                    <td>{new Date(z.lastSeenAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
