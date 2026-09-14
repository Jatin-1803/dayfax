/**
 * Central profit definitions for DayFax admin analytics.
 *
 * Date filter (all reports): orders.placed_at (order creation).
 *
 * Money: integer paise.
 *
 * INCLUDED IN SALES (item revenue)
 * - Sum of order_items.line_total_paise for orders with status = DELIVERED.
 * - Delivery fee is NOT part of "Sales" / COGS gross margin; it is added in Net Profit.
 *
 * EXCLUDED FROM SALES / COGS / GROSS / NET
 * - CANCELLED orders (inventory restored; not completed sales).
 * - Non-delivered pipeline orders (PENDING…OUT_FOR_DELIVERY) — counted in status
 *   breakdown only, not in profit KPIs.
 *
 * COST (COGS)
 * - Sum of (order_items.unit_cost_paise × quantity) using the snapshotted unit cost
 *   at checkout. Current product_variants.cost_price_paise is never used for history.
 * - Lines with NULL unit_cost_paise are excluded from cost/profit aggregates and
 *   flagged costDataAvailable=false (legacy orders before CP existed).
 *
 * RETURNS (damaged-item flow)
 * - Order stays DELIVERED; refund tracked on return_requests.
 * - Refunded item revenue is subtracted from Sales for profit.
 * - Delivery fee is never refunded (existing support policy).
 * - Damaged goods: COGS is NOT reversed (cost remains a loss).
 * - Only returns with status REFUNDED (or refund_status PAID) reduce revenue.
 *
 * TAX / DISCOUNT
 * - orders.tax_paise and discount_paise exist but checkout currently always writes 0.
 * - Formulas still subtract discount and add tax so future use stays correct.
 *
 * PAYMENT FEES
 * - Not tracked in DB today → treated as 0 in Net Profit.
 *
 * GROSS PROFIT = (delivered item revenue − refunded item revenue) − COGS
 * NET PROFIT   = GROSS PROFIT + delivery fees − discount + tax − payment fees
 * MARGIN %     = GROSS PROFIT / (delivered item revenue − refunds) × 100
 *                (null when denominator is 0)
 */

export interface LineProfitInput {
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  unitCostPaise: number | null;
  refundedPaise?: number;
}

export interface OrderProfitInput {
  itemTotalPaise: number;
  deliveryFeePaise: number;
  taxPaise: number;
  discountPaise: number;
  status: string;
  lines: LineProfitInput[];
  /** Sum of paid/refunded return line amounts attributed to this order. */
  refundedItemPaise: number;
  paymentFeesPaise?: number;
}

export interface LineProfitResult {
  quantity: number;
  unitPricePaise: number;
  unitCostPaise: number | null;
  revenuePaise: number;
  costPaise: number | null;
  profitPaise: number | null;
  costDataAvailable: boolean;
}

export interface OrderProfitResult {
  includedInSales: boolean;
  itemRevenuePaise: number;
  refundedItemPaise: number;
  netItemRevenuePaise: number;
  costPaise: number | null;
  deliveryFeePaise: number;
  taxPaise: number;
  discountPaise: number;
  paymentFeesPaise: number;
  grossProfitPaise: number | null;
  netProfitPaise: number | null;
  grossMarginPercent: number | null;
  costDataAvailable: boolean;
  lines: LineProfitResult[];
}

export function isDeliveredSalesStatus(status: string): boolean {
  return status === 'DELIVERED';
}

export function lineProfit(line: LineProfitInput): LineProfitResult {
  const revenuePaise = line.lineTotalPaise;
  const refunded = Math.max(0, Math.min(line.refundedPaise ?? 0, revenuePaise));
  const netRevenue = revenuePaise - refunded;
  if (line.unitCostPaise == null) {
    return {
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
      unitCostPaise: null,
      revenuePaise: netRevenue,
      costPaise: null,
      profitPaise: null,
      costDataAvailable: false,
    };
  }
  const costPaise = line.unitCostPaise * line.quantity;
  return {
    quantity: line.quantity,
    unitPricePaise: line.unitPricePaise,
    unitCostPaise: line.unitCostPaise,
    revenuePaise: netRevenue,
    costPaise,
    profitPaise: netRevenue - costPaise,
    costDataAvailable: true,
  };
}

export function orderProfit(input: OrderProfitInput): OrderProfitResult {
  const includedInSales = isDeliveredSalesStatus(input.status);
  const paymentFeesPaise = input.paymentFeesPaise ?? 0;

  if (!includedInSales) {
    return {
      includedInSales: false,
      itemRevenuePaise: 0,
      refundedItemPaise: 0,
      netItemRevenuePaise: 0,
      costPaise: null,
      deliveryFeePaise: 0,
      taxPaise: 0,
      discountPaise: 0,
      paymentFeesPaise: 0,
      grossProfitPaise: null,
      netProfitPaise: null,
      grossMarginPercent: null,
      costDataAvailable: true,
      lines: input.lines.map((l) => lineProfit({ ...l, refundedPaise: 0 })),
    };
  }

  const lines = input.lines.map((l) => lineProfit(l));
  const itemRevenuePaise = input.itemTotalPaise;
  const refundedItemPaise = Math.max(0, input.refundedItemPaise);
  const netItemRevenuePaise = Math.max(0, itemRevenuePaise - refundedItemPaise);
  const costDataAvailable = lines.every((l) => l.costDataAvailable);
  const costPaise = costDataAvailable
    ? lines.reduce((sum, l) => sum + (l.costPaise ?? 0), 0)
    : null;

  const grossProfitPaise =
    costPaise == null ? null : netItemRevenuePaise - costPaise;
  const netProfitPaise =
    grossProfitPaise == null
      ? null
      : grossProfitPaise +
        input.deliveryFeePaise -
        input.discountPaise +
        input.taxPaise -
        paymentFeesPaise;

  const grossMarginPercent =
    grossProfitPaise == null || netItemRevenuePaise === 0
      ? null
      : (grossProfitPaise / netItemRevenuePaise) * 100;

  return {
    includedInSales: true,
    itemRevenuePaise,
    refundedItemPaise,
    netItemRevenuePaise,
    costPaise,
    deliveryFeePaise: input.deliveryFeePaise,
    taxPaise: input.taxPaise,
    discountPaise: input.discountPaise,
    paymentFeesPaise,
    grossProfitPaise,
    netProfitPaise,
    grossMarginPercent,
    costDataAvailable,
    lines,
  };
}

export function marginPercent(profitPaise: number, revenuePaise: number): number | null {
  if (revenuePaise === 0) return null;
  return (profitPaise / revenuePaise) * 100;
}

export function roundMargin(percent: number | null, digits = 2): number | null {
  if (percent == null || !Number.isFinite(percent)) return null;
  const f = 10 ** digits;
  return Math.round(percent * f) / f;
}
