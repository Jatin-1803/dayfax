import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, formatPaise, ApiError, authorizedFetch } from '../api/client';
import type { PaginationMeta } from '../api/types';
import { useAuth } from '../auth/AuthContext';

type Preset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom';

type Tab = 'overview' | 'orders' | 'products' | 'returns' | 'payments';

interface SummaryResponse {
  range: { from: string; to: string; preset: string; filterNote: string };
  summary: {
    totalSalesPaise: number;
    totalOrders: number;
    deliveredOrders: number;
    returnedOrders: number;
    cancelledOrders: number;
    totalCostPaise: number | null;
    grossProfitPaise: number | null;
    netProfitPaise: number | null;
    profitMarginPercent: number | null;
    costDataComplete: boolean;
    linesMissingCost: number;
    deliveryFeePaise: number;
  };
  statusBreakdown: Array<{ status: string; count: number; percent: number }>;
  returns: {
    returnedOrders: number;
    returnedItems: number;
    returnValuePaise: number;
    returnedCostPaise: number;
    refundedRevenuePaise: number;
    refundedCostPaise: number;
    profitImpactPaise: number;
  };
  cancellations: {
    cancelledOrders: number;
    cancelledValuePaise: number;
    cancellationRatePercent: number;
  };
  payments: {
    codOrders: number;
    onlineOrders: number;
    codRevenuePaise: number;
    onlineRevenuePaise: number;
    paymentFeesPaise: number;
  };
}

interface TrendPoint {
  date: string;
  salesPaise: number;
  costPaise: number;
  profitPaise: number;
  orders: number;
}

interface OrderProfitRow {
  id: string;
  orderNumber: string;
  placedAt: string;
  status: string;
  itemCount: number;
  salesPaise: number;
  costPaise: number | null;
  profitPaise: number | null;
  marginPercent: number | null;
  costDataAvailable: boolean;
  paymentMethod: string | null;
  customerName: string | null;
  isLoss: boolean;
}

interface ProductProfitRow {
  productId: string;
  productName: string;
  unitsSold: number;
  revenuePaise: number;
  totalCostPaise: number | null;
  profitPaise: number | null;
  marginPercent: number | null;
  costDataAvailable: boolean;
}

interface OrderDetail {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    placedAt: string;
    customerName: string | null;
    customerPhone: string | null;
    paymentMethod: string | null;
    paymentStatus: string | null;
  };
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPricePaise: number;
    unitCostPaise: number | null;
    revenuePaise: number;
    costPaise: number | null;
    profitPaise: number | null;
    costDataAvailable: boolean;
  }>;
  financials: {
    subtotalPaise: number;
    discountPaise: number;
    taxPaise: number;
    shippingPaise: number;
    refundAdjustmentPaise: number;
    totalRevenuePaise: number;
    totalCostPaise: number | null;
    grossProfitPaise: number | null;
    applicableFeesPaise: number;
    netProfitPaise: number | null;
    grossMarginPercent: number | null;
    costDataAvailable: boolean;
    includedInSales: boolean;
  };
}

const PRESETS: Array<{ value: Preset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
];

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Order profit' },
  { id: 'products', label: 'Product profit' },
  { id: 'returns', label: 'Returns' },
  { id: 'payments', label: 'Payments' },
];

function moneyOrDash(paise: number | null | undefined, incomplete?: boolean) {
  if (paise == null || incomplete) return '—';
  if (paise < 0) return `−${formatPaise(Math.abs(paise))}`;
  return formatPaise(paise);
}

function pct(v: number | null | undefined) {
  if (v == null) return '—';
  return `${v.toFixed(2)}%`;
}

function formatDate(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ');
}

function hasAnalyticsAccess(permissions?: string[]) {
  if (!permissions?.length) return true;
  return permissions.includes('*') || permissions.includes('analytics.view');
}

function hasExportAccess(permissions?: string[]) {
  if (!permissions?.length) return true;
  return permissions.includes('*') || permissions.includes('analytics.export');
}

function queryParams(base: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  return q.toString();
}

function profitCell(paise: number | null, available: boolean) {
  if (!available || paise == null) return '—';
  if (paise < 0) {
    return <span className="ba-loss">Loss {moneyOrDash(paise)}</span>;
  }
  return moneyOrDash(paise);
}

export function BusinessAnalyticsPage() {
  const { user } = useAuth();
  const allowed = hasAnalyticsAccess(user?.permissions);
  const canExport = hasExportAccess(user?.permissions);

  const [tab, setTab] = useState<Tab>('overview');
  const [preset, setPreset] = useState<Preset>('last_30_days');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orderQ, setOrderQ] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [orderPay, setOrderPay] = useState('');
  const [orderProfit, setOrderProfit] = useState('');
  const [orderSort, setOrderSort] = useState('latest');
  const [orderPage, setOrderPage] = useState(1);
  const [orders, setOrders] = useState<OrderProfitRow[]>([]);
  const [orderMeta, setOrderMeta] = useState<PaginationMeta | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [productQ, setProductQ] = useState('');
  const [productSort, setProductSort] = useState('profit_desc');
  const [productPage, setProductPage] = useState(1);
  const [products, setProducts] = useState<ProductProfitRow[]>([]);
  const [productMeta, setProductMeta] = useState<PaginationMeta | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const rangeQuery = useMemo(() => {
    const base: Record<string, string> = { preset };
    if (preset === 'custom') {
      base.from = from;
      base.to = to;
    }
    return base;
  }, [preset, from, to]);

  const loadSummary = useCallback(async () => {
    if (preset === 'custom' && (!from || !to)) {
      setError('Select a custom date range');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qs = queryParams(rangeQuery);
      const [sum, tr] = await Promise.all([
        apiRequest<SummaryResponse>(`/admin/business-analytics/summary?${qs}`),
        apiRequest<{ points: TrendPoint[] }>(`/admin/business-analytics/trend?${qs}`),
      ]);
      setSummary(sum);
      setTrend(tr.points);
    } catch (err) {
      setSummary(null);
      setTrend([]);
      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to load business analytics. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [preset, from, to, rangeQuery]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const qs = queryParams({
        ...rangeQuery,
        page: orderPage,
        limit: 20,
        q: orderQ || undefined,
        status: orderStatus || undefined,
        paymentMethod: orderPay || undefined,
        profit: orderProfit || undefined,
        sort: orderSort,
      });
      const data = await apiRequest<{ items: OrderProfitRow[]; pagination: PaginationMeta }>(
        `/admin/business-analytics/order-profit?${qs}`,
      );
      setOrders(data.items);
      setOrderMeta(data.pagination);
    } catch (err) {
      setOrders([]);
      setOrderMeta(null);
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  }, [rangeQuery, orderPage, orderQ, orderStatus, orderPay, orderProfit, orderSort]);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const qs = queryParams({
        ...rangeQuery,
        page: productPage,
        limit: 20,
        q: productQ || undefined,
        sort: productSort,
      });
      const data = await apiRequest<{ items: ProductProfitRow[]; pagination: PaginationMeta }>(
        `/admin/business-analytics/product-profit?${qs}`,
      );
      setProducts(data.items);
      setProductMeta(data.pagination);
    } catch (err) {
      setProducts([]);
      setProductMeta(null);
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setProductsLoading(false);
    }
  }, [rangeQuery, productPage, productQ, productSort]);

  useEffect(() => {
    if (!allowed) return;
    void loadSummary();
  }, [allowed, loadSummary]);

  useEffect(() => {
    if (!allowed || tab !== 'orders') return;
    void loadOrders();
  }, [allowed, tab, loadOrders]);

  useEffect(() => {
    if (!allowed || tab !== 'products') return;
    void loadProducts();
  }, [allowed, tab, loadProducts]);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const data = await apiRequest<OrderDetail>(
          `/admin/business-analytics/order-profit/${detailId}`,
        );
        if (!cancelled) setDetail(data);
      } catch {
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailId]);

  async function onExport(report: 'summary' | 'orders' | 'products' | 'returns') {
    try {
      const qs = queryParams({ ...rangeQuery, report, format: 'csv' });
      const res = await authorizedFetch(`/admin/business-analytics/export?${qs}`);
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(json?.message || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dayfax-${report}-${summary?.range.from || preset}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  }

  if (!allowed) {
    return <div className="error-box">You do not have permission to view business analytics.</div>;
  }

  const s = summary?.summary;
  const maxTrend = Math.max(
    1,
    ...trend.map((p) => Math.max(p.salesPaise, p.costPaise, Math.abs(p.profitPaise))),
  );

  return (
    <div className="ba-page">
      <div className="page-header">
        <div>
          <h1>Business analytics</h1>
          <p>
            Profit &amp; sales by order date
            {summary ? (
              <>
                {' '}
                · <strong>{formatDate(summary.range.from)}</strong> →{' '}
                <strong>{formatDate(summary.range.to)}</strong>
              </>
            ) : null}
          </p>
        </div>
        <div className="page-actions">
          {canExport ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                void onExport(
                  tab === 'orders'
                    ? 'orders'
                    : tab === 'products'
                      ? 'products'
                      : tab === 'returns'
                        ? 'returns'
                        : 'summary',
                )
              }
            >
              Export CSV
            </button>
          ) : null}
          <button type="button" className="btn" onClick={() => void loadSummary()}>
            Refresh
          </button>
        </div>
      </div>

      <div className="toolbar">
        <select
          value={preset}
          onChange={(e) => {
            setPreset(e.target.value as Preset);
            setOrderPage(1);
            setProductPage(1);
          }}
          aria-label="Date range"
        >
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {preset === 'custom' ? (
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
            <button type="button" className="btn btn-secondary" onClick={() => void loadSummary()}>
              Apply
            </button>
          </>
        ) : null}
      </div>

      <div className="ba-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`ba-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="loading-box card">Loading analytics…</div> : null}

      {error && !loading ? (
        <div className="error-box">
          <div>{error}</div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadSummary()}>
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error && summary && s && tab === 'overview' ? (
        <div className="ba-stack">
          {!s.costDataComplete ? (
            <div className="ba-callout ba-callout-warn">
              <strong>Incomplete cost data.</strong> {s.linesMissingCost} delivered line
              {s.linesMissingCost === 1 ? '' : 's'} missing historical CP — profit shows as —.
            </div>
          ) : null}

          <div className="grid-stats">
            <div className="card stat">
              <span>Total sales</span>
              <strong>{formatPaise(s.totalSalesPaise)}</strong>
            </div>
            <div className="card stat">
              <span>Total orders</span>
              <strong>{s.totalOrders.toLocaleString('en-IN')}</strong>
            </div>
            <div className="card stat">
              <span>Delivered</span>
              <strong>{s.deliveredOrders.toLocaleString('en-IN')}</strong>
            </div>
            <div className="card stat">
              <span>Returned</span>
              <strong>{s.returnedOrders.toLocaleString('en-IN')}</strong>
            </div>
            <div className="card stat">
              <span>Cancelled</span>
              <strong>{s.cancelledOrders.toLocaleString('en-IN')}</strong>
            </div>
            <div className="card stat">
              <span>Total cost</span>
              <strong>{moneyOrDash(s.totalCostPaise)}</strong>
            </div>
            <div className={`card stat ${s.grossProfitPaise != null && s.grossProfitPaise < 0 ? 'ba-stat-loss' : ''}`}>
              <span>Gross profit</span>
              <strong>{moneyOrDash(s.grossProfitPaise)}</strong>
            </div>
            <div className={`card stat ${s.netProfitPaise != null && s.netProfitPaise < 0 ? 'ba-stat-loss' : ''}`}>
              <span>Net profit</span>
              <strong>{moneyOrDash(s.netProfitPaise)}</strong>
            </div>
          </div>

          <div className="ba-split">
            <div className="card">
              <div className="ba-section-head">
                <h2>Gross margin</h2>
                <span className="badge">{pct(s.profitMarginPercent)}</span>
              </div>
              <div className="ba-meter" aria-hidden>
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, s.profitMarginPercent ?? 0))}%`,
                  }}
                />
              </div>
              <p className="muted ba-caption">Gross profit ÷ net item sales</p>
              <table className="ba-kv">
                <tbody>
                  <tr>
                    <td>Sales</td>
                    <td>{formatPaise(s.totalSalesPaise)}</td>
                  </tr>
                  <tr>
                    <td>Cost</td>
                    <td>{moneyOrDash(s.totalCostPaise)}</td>
                  </tr>
                  <tr>
                    <td>Gross profit</td>
                    <td>{moneyOrDash(s.grossProfitPaise)}</td>
                  </tr>
                  <tr>
                    <td>Delivery fees</td>
                    <td>{formatPaise(s.deliveryFeePaise)}</td>
                  </tr>
                  <tr>
                    <td>Net profit</td>
                    <td>
                      <strong>{moneyOrDash(s.netProfitPaise)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="ba-section-head">
                <h2>Order status</h2>
              </div>
              <div className="ba-status-list">
                {summary.statusBreakdown.map((row) => (
                  <div key={row.status} className="ba-status-row">
                    <div className="ba-status-meta">
                      <span>{statusLabel(row.status)}</span>
                      <span className="muted">
                        {row.count} · {row.percent}%
                      </span>
                    </div>
                    <div className="ba-meter ba-meter-thin">
                      <div style={{ width: `${row.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="ba-section-head">
              <h2>Sales vs cost vs profit</h2>
              <div className="ba-legend">
                <span>
                  <i className="lg-sales" /> Sales
                </span>
                <span>
                  <i className="lg-cost" /> Cost
                </span>
                <span>
                  <i className="lg-profit" /> Profit
                </span>
              </div>
            </div>
            {trend.length === 0 ? (
              <div className="empty">No orders found for this period.</div>
            ) : (
              <div className="ba-trend">
                {trend.map((p) => (
                  <div key={p.date} className="ba-trend-col" title={formatDate(p.date)}>
                    <div className="ba-bars">
                      <span
                        className="ba-bar sales"
                        style={{ height: `${(p.salesPaise / maxTrend) * 100}%` }}
                      />
                      <span
                        className="ba-bar cost"
                        style={{ height: `${(p.costPaise / maxTrend) * 100}%` }}
                      />
                      <span
                        className={`ba-bar profit${p.profitPaise < 0 ? ' neg' : ''}`}
                        style={{ height: `${(Math.abs(p.profitPaise) / maxTrend) * 100}%` }}
                      />
                    </div>
                    <small>{p.date.slice(8)}/{p.date.slice(5, 7)}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {!loading && !error && tab === 'orders' ? (
        <div className="ba-stack">
          <div className="toolbar">
            <input
              placeholder="Order #, product, customer"
              value={orderQ}
              onChange={(e) => {
                setOrderQ(e.target.value);
                setOrderPage(1);
              }}
            />
            <select
              value={orderStatus}
              onChange={(e) => {
                setOrderStatus(e.target.value);
                setOrderPage(1);
              }}
            >
              <option value="">All statuses</option>
              {[
                'PENDING',
                'CONFIRMED',
                'PREPARING',
                'READY_FOR_PICKUP',
                'PICKED_UP',
                'OUT_FOR_DELIVERY',
                'DELIVERED',
                'CANCELLED',
              ].map((st) => (
                <option key={st} value={st}>
                  {statusLabel(st)}
                </option>
              ))}
            </select>
            <select
              value={orderPay}
              onChange={(e) => {
                setOrderPay(e.target.value);
                setOrderPage(1);
              }}
            >
              <option value="">All payments</option>
              <option value="COD">COD</option>
              <option value="ONLINE">Online</option>
            </select>
            <select
              value={orderProfit}
              onChange={(e) => {
                setOrderProfit(e.target.value);
                setOrderPage(1);
              }}
            >
              <option value="">All profit</option>
              <option value="positive">Profit &gt; 0</option>
              <option value="negative">Loss</option>
              <option value="unknown">CP unavailable</option>
            </select>
            <select value={orderSort} onChange={(e) => setOrderSort(e.target.value)}>
              <option value="latest">Latest</option>
              <option value="profit_desc">Highest profit</option>
              <option value="profit_asc">Lowest profit</option>
              <option value="sales_desc">Highest sales</option>
              <option value="cost_desc">Highest cost</option>
            </select>
          </div>

          {ordersLoading ? <div className="loading-box card">Loading orders…</div> : null}
          {!ordersLoading && orders.length === 0 ? (
            <div className="empty card">No orders found for this period.</div>
          ) : null}
          {!ordersLoading && orders.length > 0 ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Sales</th>
                    <th>CP</th>
                    <th>Profit</th>
                    <th>Margin</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      className={`ba-click-row${o.isLoss ? ' ba-row-loss' : ''}`}
                      onClick={() => setDetailId(o.id)}
                    >
                      <td>
                        <strong>{o.orderNumber}</strong>
                        {o.isLoss ? (
                          <>
                            {' '}
                            <span className="badge badge-danger">Loss</span>
                          </>
                        ) : null}
                      </td>
                      <td>{formatDate(o.placedAt)}</td>
                      <td>{o.itemCount}</td>
                      <td>{formatPaise(o.salesPaise)}</td>
                      <td>{moneyOrDash(o.costPaise, !o.costDataAvailable)}</td>
                      <td>{profitCell(o.profitPaise, o.costDataAvailable)}</td>
                      <td>{pct(o.marginPercent)}</td>
                      <td>
                        <span className="badge badge-muted">{statusLabel(o.status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {orderMeta ? <Pager meta={orderMeta} onPage={setOrderPage} /> : null}
        </div>
      ) : null}

      {!loading && !error && tab === 'products' ? (
        <div className="ba-stack">
          <div className="toolbar">
            <input
              placeholder="Search product"
              value={productQ}
              onChange={(e) => {
                setProductQ(e.target.value);
                setProductPage(1);
              }}
            />
            <select value={productSort} onChange={(e) => setProductSort(e.target.value)}>
              <option value="revenue_desc">Highest revenue</option>
              <option value="profit_desc">Highest profit</option>
              <option value="profit_asc">Lowest profit</option>
              <option value="margin_desc">Highest margin</option>
              <option value="margin_asc">Lowest margin</option>
              <option value="units_desc">Units sold</option>
            </select>
          </div>

          {productsLoading ? <div className="loading-box card">Loading products…</div> : null}
          {!productsLoading && products.length === 0 ? (
            <div className="empty card">No product sales for this period.</div>
          ) : null}
          {!productsLoading && products.length > 0 ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Units</th>
                    <th>Revenue</th>
                    <th>Total CP</th>
                    <th>Profit</th>
                    <th>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr
                      key={p.productId}
                      className={
                        p.profitPaise != null && p.profitPaise < 0 ? 'ba-row-loss' : undefined
                      }
                    >
                      <td>
                        <strong>{p.productName}</strong>
                      </td>
                      <td>{p.unitsSold}</td>
                      <td>{formatPaise(p.revenuePaise)}</td>
                      <td>{moneyOrDash(p.totalCostPaise, !p.costDataAvailable)}</td>
                      <td>{profitCell(p.profitPaise, p.costDataAvailable)}</td>
                      <td>{pct(p.marginPercent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {productMeta ? <Pager meta={productMeta} onPage={setProductPage} /> : null}
        </div>
      ) : null}

      {!loading && !error && summary && tab === 'returns' ? (
        <div className="ba-stack">
          <div className="grid-stats">
            <div className="card stat">
              <span>Returned orders</span>
              <strong>{summary.returns.returnedOrders}</strong>
            </div>
            <div className="card stat">
              <span>Returned items</span>
              <strong>{summary.returns.returnedItems}</strong>
            </div>
            <div className="card stat">
              <span>Return value</span>
              <strong>{formatPaise(summary.returns.returnValuePaise)}</strong>
            </div>
            <div className="card stat">
              <span>Returned cost</span>
              <strong>{formatPaise(summary.returns.returnedCostPaise)}</strong>
            </div>
            <div className="card stat">
              <span>Revenue refunded</span>
              <strong>{formatPaise(summary.returns.refundedRevenuePaise)}</strong>
            </div>
            <div className="card stat ba-stat-loss">
              <span>Profit impact</span>
              <strong>{moneyOrDash(summary.returns.profitImpactPaise)}</strong>
            </div>
          </div>
          <div className="grid-stats">
            <div className="card stat">
              <span>Cancelled orders</span>
              <strong>{summary.cancellations.cancelledOrders}</strong>
            </div>
            <div className="card stat">
              <span>Cancellation rate</span>
              <strong>{summary.cancellations.cancellationRatePercent}%</strong>
            </div>
            <div className="card stat">
              <span>Cancelled value</span>
              <strong>{formatPaise(summary.cancellations.cancelledValuePaise)}</strong>
            </div>
          </div>
          <p className="muted ba-caption">
            Cancelled orders are excluded from sales and profit. Damaged returns reverse refunded
            revenue; cost is not recovered.
          </p>
        </div>
      ) : null}

      {!loading && !error && summary && tab === 'payments' ? (
        <div className="ba-stack">
          <div className="grid-stats">
            <div className="card stat">
              <span>COD orders</span>
              <strong>{summary.payments.codOrders}</strong>
            </div>
            <div className="card stat">
              <span>Online orders</span>
              <strong>{summary.payments.onlineOrders}</strong>
            </div>
            <div className="card stat">
              <span>COD revenue</span>
              <strong>{formatPaise(summary.payments.codRevenuePaise)}</strong>
            </div>
            <div className="card stat">
              <span>Online revenue</span>
              <strong>{formatPaise(summary.payments.onlineRevenuePaise)}</strong>
            </div>
            <div className="card stat">
              <span>Payment fees</span>
              <strong>{formatPaise(summary.payments.paymentFeesPaise)}</strong>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                Not tracked yet
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {detailId ? (
        <div
          className="ba-drawer-backdrop"
          onClick={() => setDetailId(null)}
          role="presentation"
        >
          <aside
            className="ba-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Order profit detail"
          >
            <div className="ba-drawer-head">
              <div>
                <h2>Order profit</h2>
                {detail ? (
                  <p className="muted">{detail.order.orderNumber}</p>
                ) : null}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetailId(null)}>
                Close
              </button>
            </div>

            {detailLoading ? <div className="loading-box">Loading…</div> : null}
            {!detailLoading && !detail ? (
              <div className="error-box">Unable to load order detail.</div>
            ) : null}

            {detail ? (
              <div className="ba-drawer-body">
                <section className="ba-drawer-section">
                  <h3>Summary</h3>
                  <div className="ba-meta-grid">
                    <div>
                      <span className="muted">Date</span>
                      <strong>{formatDate(detail.order.placedAt)}</strong>
                    </div>
                    <div>
                      <span className="muted">Customer</span>
                      <strong>
                        {detail.order.customerName || detail.order.customerPhone || '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="muted">Status</span>
                      <strong>{statusLabel(detail.order.status)}</strong>
                    </div>
                    <div>
                      <span className="muted">Payment</span>
                      <strong>
                        {detail.order.paymentMethod || '—'}
                        {detail.order.paymentStatus ? ` · ${detail.order.paymentStatus}` : ''}
                      </strong>
                    </div>
                  </div>
                </section>

                <section className="ba-drawer-section">
                  <h3>Products</h3>
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Qty</th>
                          <th>SP</th>
                          <th>CP</th>
                          <th>Revenue</th>
                          <th>Cost</th>
                          <th>Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.productName}</td>
                            <td>{item.quantity}</td>
                            <td>{formatPaise(item.unitPricePaise)}</td>
                            <td>{moneyOrDash(item.unitCostPaise, !item.costDataAvailable)}</td>
                            <td>{formatPaise(item.revenuePaise)}</td>
                            <td>{moneyOrDash(item.costPaise, !item.costDataAvailable)}</td>
                            <td>{profitCell(item.profitPaise, item.costDataAvailable)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="ba-drawer-section">
                  <h3>Financials</h3>
                  <table className="ba-kv">
                    <tbody>
                      <tr>
                        <td>Subtotal</td>
                        <td>{formatPaise(detail.financials.subtotalPaise)}</td>
                      </tr>
                      <tr>
                        <td>Discount</td>
                        <td>{formatPaise(detail.financials.discountPaise)}</td>
                      </tr>
                      <tr>
                        <td>Tax</td>
                        <td>{formatPaise(detail.financials.taxPaise)}</td>
                      </tr>
                      <tr>
                        <td>Shipping</td>
                        <td>{formatPaise(detail.financials.shippingPaise)}</td>
                      </tr>
                      <tr>
                        <td>Refund / return</td>
                        <td>{moneyOrDash(detail.financials.refundAdjustmentPaise)}</td>
                      </tr>
                      <tr>
                        <td>Total revenue</td>
                        <td>{formatPaise(detail.financials.totalRevenuePaise)}</td>
                      </tr>
                      <tr>
                        <td>Total cost</td>
                        <td>
                          {moneyOrDash(
                            detail.financials.totalCostPaise,
                            !detail.financials.costDataAvailable,
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>Gross profit</td>
                        <td>
                          {moneyOrDash(
                            detail.financials.grossProfitPaise,
                            !detail.financials.costDataAvailable,
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>Fees</td>
                        <td>{formatPaise(detail.financials.applicableFeesPaise)}</td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Net profit</strong>
                        </td>
                        <td>
                          <strong>
                            {moneyOrDash(
                              detail.financials.netProfitPaise,
                              !detail.financials.costDataAvailable,
                            )}
                          </strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {!detail.financials.includedInSales ? (
                    <p className="muted ba-caption">
                      Not included in delivered sales KPIs (status is not Delivered).
                    </p>
                  ) : null}
                </section>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function Pager({
  meta,
  onPage,
}: {
  meta: PaginationMeta;
  onPage: (fn: (p: number) => number) => void;
}) {
  return (
    <div className="ba-pager">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={!meta.hasPreviousPage}
        onClick={() => onPage((p) => Math.max(1, p - 1))}
      >
        Previous
      </button>
      <span className="muted">
        Page {meta.page} of {meta.totalPages}
      </span>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={!meta.hasNextPage}
        onClick={() => onPage((p) => p + 1)}
      >
        Next
      </button>
    </div>
  );
}
