import { NotFoundError } from '../../common/errors/app-error.js';
import { paginatedMeta } from '../../common/utils/pagination.js';
import { BusinessAnalyticsRepository } from './business-analytics.repository.js';
import type {
  AnalyticsExportQueryInput,
  AnalyticsOrdersQueryInput,
  AnalyticsProductsQueryInput,
  AnalyticsRangeInput,
  AnalyticsTrendQueryInput,
} from './business-analytics.schema.js';
import { resolveAnalyticsRange } from './date-range.js';
import { orderProfit, roundMargin } from './profit-calc.js';

function ymdFromMysqlDate(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export class BusinessAnalyticsService {
  constructor(private readonly repo = new BusinessAnalyticsRepository()) {}

  async summary(input: AnalyticsRangeInput) {
    const range = resolveAnalyticsRange(input);
    const [counts, cost, returns, returnItems, payments] = await Promise.all([
      this.repo.summaryCounts(range),
      this.repo.deliveredCost(range),
      this.repo.returnedOrdersInRange(range),
      this.repo.returnedItemsImpact(range),
      this.repo.paymentBreakdown(range),
    ]);

    const totalOrders = Number(counts.total_orders ?? 0);
    const deliveredOrders = Number(counts.delivered_orders ?? 0);
    const cancelledOrders = Number(counts.cancelled_orders ?? 0);
    const returnedOrders = Number(returns.returned_orders ?? 0);

    const deliveredSalesPaise = Number(counts.delivered_item_sales_paise ?? 0);
    const refundedRevenuePaise = Number(returnItems.refunded_revenue_paise ?? 0);
    const totalSalesPaise = Math.max(0, deliveredSalesPaise - refundedRevenuePaise);
    const totalCostPaise = Number(cost.total_cost_paise ?? 0);
    const linesMissingCost = Number(cost.lines_missing_cost ?? 0);
    const costDataComplete = linesMissingCost === 0;

    const deliveryFeePaise = Number(counts.delivered_delivery_fee_paise ?? 0);
    const discountPaise = Number(counts.delivered_discount_paise ?? 0);
    const taxPaise = Number(counts.delivered_tax_paise ?? 0);

    const grossProfitPaise = costDataComplete
      ? totalSalesPaise - totalCostPaise
      : null;
    const netProfitPaise =
      grossProfitPaise == null
        ? null
        : grossProfitPaise + deliveryFeePaise - discountPaise + taxPaise;
    const profitMargin =
      grossProfitPaise == null || totalSalesPaise === 0
        ? null
        : roundMargin((grossProfitPaise / totalSalesPaise) * 100);

    const statusBreakdown = [
      { status: 'PENDING', count: Number(counts.pending_orders ?? 0) },
      { status: 'CONFIRMED', count: Number(counts.confirmed_orders ?? 0) },
      { status: 'PREPARING', count: Number(counts.preparing_orders ?? 0) },
      { status: 'READY_FOR_PICKUP', count: Number(counts.ready_orders ?? 0) },
      { status: 'PICKED_UP', count: Number(counts.picked_up_orders ?? 0) },
      { status: 'OUT_FOR_DELIVERY', count: Number(counts.out_for_delivery_orders ?? 0) },
      { status: 'DELIVERED', count: deliveredOrders },
      { status: 'CANCELLED', count: cancelledOrders },
    ].map((row) => ({
      ...row,
      percent: totalOrders === 0 ? 0 : roundMargin((row.count / totalOrders) * 100) ?? 0,
    }));

    return {
      range: {
        preset: range.preset,
        from: range.fromYmd,
        to: range.toYmd,
        filterField: 'placed_at' as const,
        filterNote:
          'All metrics filter by order creation time (orders.placed_at). Return impact is attributed to the original order’s period.',
      },
      definitions: {
        totalSales:
          'Delivered order item revenue minus paid/refunded return amounts. Delivery fees excluded.',
        totalCost:
          'Sum of snapshotted unit_cost_paise × qty on delivered order lines. Legacy NULL costs make profit unavailable.',
        grossProfit: 'Net item sales − COGS (damaged-return COGS not reversed).',
        netProfit: 'Gross profit + delivery fees − discount + tax. Payment gateway fees not tracked (0).',
      },
      summary: {
        totalSalesPaise,
        totalOrders,
        deliveredOrders,
        returnedOrders,
        cancelledOrders,
        totalCostPaise: costDataComplete ? totalCostPaise : null,
        grossProfitPaise,
        netProfitPaise,
        profitMarginPercent: profitMargin,
        costDataComplete,
        linesMissingCost,
        deliveryFeePaise,
        discountPaise,
        taxPaise,
      },
      statusBreakdown,
      returns: {
        returnedOrders,
        returnRequestCount: Number(returns.return_request_count ?? 0),
        returnedItems: Number(returnItems.returned_items ?? 0),
        returnValuePaise: Number(returnItems.return_value_paise ?? 0),
        returnedCostPaise: Number(returnItems.returned_cost_paise ?? 0),
        refundedRevenuePaise,
        refundedCostPaise: Number(returnItems.refunded_cost_paise ?? 0),
        profitImpactPaise: -(refundedRevenuePaise + Number(returnItems.refunded_cost_paise ?? 0)),
      },
      cancellations: {
        cancelledOrders,
        cancelledValuePaise: Number(counts.cancelled_value_paise ?? 0),
        cancellationRatePercent:
          totalOrders === 0
            ? 0
            : roundMargin((cancelledOrders / totalOrders) * 100) ?? 0,
      },
      payments: {
        codOrders: Number(payments.cod_orders ?? 0),
        onlineOrders: Number(payments.online_orders ?? 0),
        codRevenuePaise: Number(payments.cod_revenue_paise ?? 0),
        onlineRevenuePaise: Number(payments.online_revenue_paise ?? 0),
        onlineCapturedRevenuePaise: Number(payments.online_captured_revenue_paise ?? 0),
        paymentFeesPaise: 0,
      },
    };
  }

  async trend(input: AnalyticsTrendQueryInput) {
    const range = resolveAnalyticsRange(input);
    const { salesRows, costRows, refundRows } = await this.repo.dailyTrend(range);
    const costByDay = new Map(
      costRows.map((r) => [ymdFromMysqlDate(r.day), Number(r.cost_paise ?? 0)]),
    );
    const refundByDay = new Map(
      refundRows.map((r) => [ymdFromMysqlDate(r.day), Number(r.refunded_paise ?? 0)]),
    );

    const points = salesRows.map((r) => {
      const day = ymdFromMysqlDate(r.day);
      const salesPaise = Math.max(
        0,
        Number(r.sales_paise ?? 0) - (refundByDay.get(day) ?? 0),
      );
      const costPaise = costByDay.get(day) ?? 0;
      const profitPaise = salesPaise - costPaise;
      return {
        date: day,
        salesPaise,
        costPaise,
        profitPaise,
        orders: Number(r.orders ?? 0),
      };
    });

    return {
      range: { from: range.fromYmd, to: range.toYmd, preset: range.preset },
      granularity: input.granularity,
      points,
    };
  }

  async orderProfitList(input: AnalyticsOrdersQueryInput) {
    const range = resolveAnalyticsRange(input);
    const total = await this.repo.countOrders({
      range,
      status: input.status,
      paymentMethod: input.paymentMethod,
      q: input.q,
    });

    // Fetch a page (or wider when profit filter needs post-filter)
    const needsPostFilter = Boolean(input.profit);
    const fetchLimit = needsPostFilter ? Math.min(500, Math.max(input.limit * 5, 100)) : input.limit;
    const fetchOffset = needsPostFilter ? 0 : (input.page - 1) * input.limit;

    const rows = await this.repo.listOrders({
      range,
      status: input.status,
      paymentMethod: input.paymentMethod,
      q: input.q,
      sort: input.sort,
      limit: fetchLimit,
      offset: fetchOffset,
    });

    let items = rows.map((row) => this.mapOrderRow(row));
    if (input.profit === 'positive') {
      items = items.filter((i) => i.profitPaise != null && i.profitPaise > 0);
    } else if (input.profit === 'negative') {
      items = items.filter((i) => i.profitPaise != null && i.profitPaise < 0);
    } else if (input.profit === 'unknown') {
      items = items.filter((i) => !i.costDataAvailable || i.profitPaise == null);
    }

    if (needsPostFilter) {
      const start = (input.page - 1) * input.limit;
      const pageItems = items.slice(start, start + input.limit);
      return {
        range: { from: range.fromYmd, to: range.toYmd, preset: range.preset },
        items: pageItems,
        pagination: paginatedMeta(items.length, input.page, input.limit),
      };
    }

    return {
      range: { from: range.fromYmd, to: range.toYmd, preset: range.preset },
      items,
      pagination: paginatedMeta(total, input.page, input.limit),
    };
  }

  async orderProfitDetail(orderId: string) {
    const detail = await this.repo.getOrderDetail(orderId);
    if (!detail) throw new NotFoundError('Order not found');

    const refundByItem = new Map<string, number>();
    for (const r of detail.refunds) {
      const paid =
        r.status === 'REFUNDED' || r.refund_status === 'PAID';
      if (!paid) continue;
      const id = r.order_item_id as string;
      refundByItem.set(id, (refundByItem.get(id) ?? 0) + Number(r.line_refund_paise ?? 0));
    }

    const refundedItemPaise = [...refundByItem.values()].reduce((a, b) => a + b, 0);
    const lines = detail.items.map((item) => ({
      quantity: Number(item.quantity),
      unitPricePaise: Number(item.unit_price_paise),
      lineTotalPaise: Number(item.line_total_paise),
      unitCostPaise:
        item.unit_cost_paise == null ? null : Number(item.unit_cost_paise),
      refundedPaise: refundByItem.get(item.id as string) ?? 0,
    }));

    const profit = orderProfit({
      itemTotalPaise: Number(detail.order.item_total_paise),
      deliveryFeePaise: Number(detail.order.delivery_fee_paise),
      taxPaise: Number(detail.order.tax_paise),
      discountPaise: Number(detail.order.discount_paise),
      status: detail.order.status as string,
      refundedItemPaise,
      lines,
    });

    return {
      order: {
        id: detail.order.id as string,
        orderNumber: detail.order.order_number as string,
        status: detail.order.status as string,
        placedAt: detail.order.placed_at,
        customerName: (detail.order.customer_name as string | null) ?? null,
        customerPhone: (detail.order.customer_phone as string | null) ?? null,
        paymentMethod: (detail.order.payment_method as string | null) ?? null,
        paymentStatus: (detail.order.payment_status as string | null) ?? null,
      },
      items: detail.items.map((item, idx) => {
        const line = profit.lines[idx]!;
        return {
          id: item.id as string,
          productId: item.product_id as string,
          productName: item.product_name as string,
          variantLabel: item.variant_label as string,
          quantity: Number(item.quantity),
          unitPricePaise: Number(item.unit_price_paise),
          unitCostPaise:
            item.unit_cost_paise == null ? null : Number(item.unit_cost_paise),
          revenuePaise: line.revenuePaise,
          costPaise: line.costPaise,
          profitPaise: line.profitPaise,
          costDataAvailable: line.costDataAvailable,
          isLocalShop: Boolean(item.is_local_shop),
        };
      }),
      financials: {
        subtotalPaise: Number(detail.order.item_total_paise),
        discountPaise: Number(detail.order.discount_paise),
        taxPaise: Number(detail.order.tax_paise),
        shippingPaise: Number(detail.order.delivery_fee_paise),
        refundAdjustmentPaise: -refundedItemPaise,
        totalRevenuePaise: profit.netItemRevenuePaise,
        totalCostPaise: profit.costPaise,
        grossProfitPaise: profit.grossProfitPaise,
        applicableFeesPaise: 0,
        netProfitPaise: profit.netProfitPaise,
        grossMarginPercent: roundMargin(profit.grossMarginPercent),
        costDataAvailable: profit.costDataAvailable,
        includedInSales: profit.includedInSales,
      },
    };
  }

  async productProfitList(input: AnalyticsProductsQueryInput) {
    const range = resolveAnalyticsRange(input);
    const total = await this.repo.countProducts({ range, q: input.q });
    const rows = await this.repo.listProducts({
      range,
      q: input.q,
      sort: input.sort,
      limit: input.limit,
      offset: (input.page - 1) * input.limit,
    });

    const items = rows.map((row) => {
      const revenuePaise = Number(row.revenue_paise ?? 0);
      const costPaise = Number(row.cost_paise ?? 0);
      const missing = Number(row.missing_cost_lines ?? 0);
      const costDataAvailable = missing === 0;
      const profitPaise = costDataAvailable ? revenuePaise - costPaise : null;
      return {
        productId: row.product_id as string,
        productName: row.product_name as string,
        unitsSold: Number(row.units_sold ?? 0),
        revenuePaise,
        totalCostPaise: costDataAvailable ? costPaise : null,
        profitPaise,
        marginPercent:
          profitPaise == null || revenuePaise === 0
            ? null
            : roundMargin((profitPaise / revenuePaise) * 100),
        costDataAvailable,
      };
    });

    return {
      range: { from: range.fromYmd, to: range.toYmd, preset: range.preset },
      items,
      pagination: paginatedMeta(total, input.page, input.limit),
    };
  }

  async exportCsv(input: AnalyticsExportQueryInput) {
    if (input.report === 'summary' || input.report === 'returns') {
      const data = await this.summary(input);
      if (input.report === 'returns') {
        const r = data.returns;
        return {
          filename: `returns-${data.range.from}_${data.range.to}.csv`,
          contentType: 'text/csv; charset=utf-8',
          body: toCsv(
            [
              'returned_orders',
              'returned_items',
              'return_value_paise',
              'returned_cost_paise',
              'refunded_revenue_paise',
              'profit_impact_paise',
            ],
            [
              [
                r.returnedOrders,
                r.returnedItems,
                r.returnValuePaise,
                r.returnedCostPaise,
                r.refundedRevenuePaise,
                r.profitImpactPaise,
              ],
            ],
          ),
        };
      }
      const s = data.summary;
      return {
        filename: `analytics-summary-${data.range.from}_${data.range.to}.csv`,
        contentType: 'text/csv; charset=utf-8',
        body: toCsv(
          [
            'total_sales_paise',
            'total_orders',
            'delivered_orders',
            'returned_orders',
            'cancelled_orders',
            'total_cost_paise',
            'gross_profit_paise',
            'net_profit_paise',
            'profit_margin_percent',
          ],
          [
            [
              s.totalSalesPaise,
              s.totalOrders,
              s.deliveredOrders,
              s.returnedOrders,
              s.cancelledOrders,
              s.totalCostPaise,
              s.grossProfitPaise,
              s.netProfitPaise,
              s.profitMarginPercent,
            ],
          ],
        ),
      };
    }

    if (input.report === 'products') {
      const data = await this.productProfitList({
        ...input,
        page: 1,
        limit: 5000,
        sort: (input.sort as AnalyticsProductsQueryInput['sort']) || 'profit_desc',
      });
      return {
        filename: `product-profit-${data.range.from}_${data.range.to}.csv`,
        contentType: 'text/csv; charset=utf-8',
        body: toCsv(
          [
            'product_id',
            'product_name',
            'units_sold',
            'revenue_paise',
            'total_cost_paise',
            'profit_paise',
            'margin_percent',
          ],
          data.items.map((i) => [
            i.productId,
            i.productName,
            i.unitsSold,
            i.revenuePaise,
            i.totalCostPaise,
            i.profitPaise,
            i.marginPercent,
          ]),
        ),
      };
    }

    const data = await this.orderProfitList({
      ...input,
      page: 1,
      limit: 5000,
      sort: (input.sort as AnalyticsOrdersQueryInput['sort']) || 'latest',
    });
    return {
      filename: `order-profit-${data.range.from}_${data.range.to}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: toCsv(
        [
          'order_number',
          'placed_at',
          'status',
          'items',
          'sales_paise',
          'cost_paise',
          'profit_paise',
          'margin_percent',
          'payment_method',
        ],
        data.items.map((i) => [
          i.orderNumber,
          i.placedAt,
          i.status,
          i.itemCount,
          i.salesPaise,
          i.costPaise,
          i.profitPaise,
          i.marginPercent,
          i.paymentMethod,
        ]),
      ),
    };
  }

  private mapOrderRow(row: Record<string, unknown>) {
    const status = row.status as string;
    const itemTotal = Number(row.item_total_paise ?? 0);
    const refunded = Number(row.refunded_paise ?? 0);
    const cost = Number(row.cost_paise ?? 0);
    const missing = Number(row.missing_cost_lines ?? 0);
    const costDataAvailable = missing === 0;
    const profit = orderProfit({
      itemTotalPaise: itemTotal,
      deliveryFeePaise: Number(row.delivery_fee_paise ?? 0),
      taxPaise: Number(row.tax_paise ?? 0),
      discountPaise: Number(row.discount_paise ?? 0),
      status,
      refundedItemPaise: refunded,
      lines: [
        {
          quantity: 1,
          unitPricePaise: itemTotal,
          lineTotalPaise: itemTotal,
          unitCostPaise: costDataAvailable ? cost : null,
        },
      ],
    });

    return {
      id: row.id as string,
      orderNumber: row.order_number as string,
      placedAt: row.placed_at,
      status,
      itemCount: Number(row.item_count ?? 0),
      salesPaise: status === 'DELIVERED' ? Math.max(0, itemTotal - refunded) : itemTotal,
      costPaise: status === 'DELIVERED' && costDataAvailable ? cost : null,
      profitPaise: profit.grossProfitPaise,
      netProfitPaise: profit.netProfitPaise,
      marginPercent: roundMargin(profit.grossMarginPercent),
      costDataAvailable: status === 'DELIVERED' ? costDataAvailable : true,
      paymentMethod: (row.payment_method as string | null) ?? null,
      paymentStatus: (row.payment_status as string | null) ?? null,
      customerName: (row.customer_name as string | null) ?? null,
      isLoss: profit.grossProfitPaise != null && profit.grossProfitPaise < 0,
    };
  }
}
