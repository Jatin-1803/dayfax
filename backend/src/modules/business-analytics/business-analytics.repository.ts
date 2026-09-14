import type { Pool, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import type { DateRange } from './date-range.js';

const PAID_RETURN_STATUSES = `('REFUNDED')`;
const PAID_REFUND_STATUSES = `('PAID')`;

export class BusinessAnalyticsRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async summaryCounts(range: DateRange) {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS total_orders,
         SUM(o.status = 'DELIVERED') AS delivered_orders,
         SUM(o.status = 'CANCELLED') AS cancelled_orders,
         SUM(o.status = 'PENDING') AS pending_orders,
         SUM(o.status = 'CONFIRMED') AS confirmed_orders,
         SUM(o.status = 'PREPARING') AS preparing_orders,
         SUM(o.status = 'READY_FOR_PICKUP') AS ready_orders,
         SUM(o.status = 'PICKED_UP') AS picked_up_orders,
         SUM(o.status = 'OUT_FOR_DELIVERY') AS out_for_delivery_orders,
         COALESCE(SUM(CASE WHEN o.status = 'DELIVERED' THEN o.item_total_paise ELSE 0 END), 0) AS delivered_item_sales_paise,
         COALESCE(SUM(CASE WHEN o.status = 'DELIVERED' THEN o.delivery_fee_paise ELSE 0 END), 0) AS delivered_delivery_fee_paise,
         COALESCE(SUM(CASE WHEN o.status = 'DELIVERED' THEN o.discount_paise ELSE 0 END), 0) AS delivered_discount_paise,
         COALESCE(SUM(CASE WHEN o.status = 'DELIVERED' THEN o.tax_paise ELSE 0 END), 0) AS delivered_tax_paise,
         COALESCE(SUM(CASE WHEN o.status = 'CANCELLED' THEN o.grand_total_paise ELSE 0 END), 0) AS cancelled_value_paise
       FROM orders o
       WHERE o.placed_at >= ? AND o.placed_at <= ?`,
      [range.from, range.to],
    );
    return rows[0]!;
  }

  async deliveredCost(range: DateRange) {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(
           CASE WHEN oi.unit_cost_paise IS NOT NULL
             THEN oi.unit_cost_paise * oi.quantity ELSE 0 END
         ), 0) AS total_cost_paise,
         SUM(oi.unit_cost_paise IS NULL) AS lines_missing_cost,
         COUNT(*) AS line_count
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE o.status = 'DELIVERED'
         AND o.placed_at >= ? AND o.placed_at <= ?`,
      [range.from, range.to],
    );
    return rows[0]!;
  }

  async returnedOrdersInRange(range: DateRange) {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
         COUNT(DISTINCT rr.order_id) AS returned_orders,
         COALESCE(SUM(CASE
           WHEN rr.status IN ${PAID_RETURN_STATUSES} OR rr.refund_status IN ${PAID_REFUND_STATUSES}
           THEN rr.refund_amount_paise ELSE 0 END), 0) AS refunded_revenue_paise,
         COALESCE(SUM(rr.refund_amount_paise), 0) AS return_value_paise,
         COUNT(*) AS return_request_count
       FROM return_requests rr
       INNER JOIN orders o ON o.id = rr.order_id
       WHERE o.placed_at >= ? AND o.placed_at <= ?
         AND rr.status <> 'REJECTED'`,
      [range.from, range.to],
    );
    return rows[0]!;
  }

  async returnedItemsImpact(range: DateRange) {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(ri.quantity), 0) AS returned_items,
         COALESCE(SUM(ri.line_refund_paise), 0) AS return_value_paise,
         COALESCE(SUM(
           CASE WHEN oi.unit_cost_paise IS NOT NULL
             THEN oi.unit_cost_paise * ri.quantity ELSE 0 END
         ), 0) AS returned_cost_paise,
         COALESCE(SUM(
           CASE
             WHEN (rr.status IN ${PAID_RETURN_STATUSES} OR rr.refund_status IN ${PAID_REFUND_STATUSES})
               AND oi.unit_cost_paise IS NOT NULL
             THEN oi.unit_cost_paise * ri.quantity
             ELSE 0
           END
         ), 0) AS refunded_cost_paise,
         COALESCE(SUM(
           CASE
             WHEN rr.status IN ${PAID_RETURN_STATUSES} OR rr.refund_status IN ${PAID_REFUND_STATUSES}
             THEN ri.line_refund_paise ELSE 0
           END
         ), 0) AS refunded_revenue_paise
       FROM return_request_items ri
       INNER JOIN return_requests rr ON rr.id = ri.return_request_id
       INNER JOIN order_items oi ON oi.id = ri.order_item_id
       INNER JOIN orders o ON o.id = rr.order_id
       WHERE o.placed_at >= ? AND o.placed_at <= ?
         AND rr.status <> 'REJECTED'`,
      [range.from, range.to],
    );
    return rows[0]!;
  }

  async paymentBreakdown(range: DateRange) {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
         SUM(CASE WHEN p.method = 'COD' AND o.status = 'DELIVERED' THEN 1 ELSE 0 END) AS cod_orders,
         SUM(CASE WHEN p.method <> 'COD' AND o.status = 'DELIVERED' THEN 1 ELSE 0 END) AS online_orders,
         COALESCE(SUM(CASE WHEN p.method = 'COD' AND o.status = 'DELIVERED' THEN o.item_total_paise ELSE 0 END), 0) AS cod_revenue_paise,
         COALESCE(SUM(CASE WHEN p.method <> 'COD' AND o.status = 'DELIVERED' THEN o.item_total_paise ELSE 0 END), 0) AS online_revenue_paise,
         COALESCE(SUM(CASE
           WHEN o.status = 'DELIVERED' AND p.status IN ('CAPTURED', 'REFUNDED') AND p.method <> 'COD'
           THEN o.item_total_paise ELSE 0 END), 0) AS online_captured_revenue_paise
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.placed_at >= ? AND o.placed_at <= ?`,
      [range.from, range.to],
    );
    return rows[0]!;
  }

  async dailyTrend(range: DateRange) {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
         DATE(o.placed_at) AS day,
         COALESCE(SUM(CASE WHEN o.status = 'DELIVERED' THEN o.item_total_paise ELSE 0 END), 0) AS sales_paise,
         COALESCE(SUM(CASE WHEN o.status = 'DELIVERED' THEN o.delivery_fee_paise ELSE 0 END), 0) AS delivery_paise,
         COUNT(*) AS orders
       FROM orders o
       WHERE o.placed_at >= ? AND o.placed_at <= ?
       GROUP BY DATE(o.placed_at)
       ORDER BY day ASC`,
      [range.from, range.to],
    );

    const [costRows] = await this.db.query<RowDataPacket[]>(
      `SELECT
         DATE(o.placed_at) AS day,
         COALESCE(SUM(
           CASE WHEN oi.unit_cost_paise IS NOT NULL AND o.status = 'DELIVERED'
             THEN oi.unit_cost_paise * oi.quantity ELSE 0 END
         ), 0) AS cost_paise
       FROM orders o
       INNER JOIN order_items oi ON oi.order_id = o.id
       WHERE o.placed_at >= ? AND o.placed_at <= ?
       GROUP BY DATE(o.placed_at)
       ORDER BY day ASC`,
      [range.from, range.to],
    );

    const [refundRows] = await this.db.query<RowDataPacket[]>(
      `SELECT
         DATE(o.placed_at) AS day,
         COALESCE(SUM(
           CASE WHEN rr.status IN ${PAID_RETURN_STATUSES} OR rr.refund_status IN ${PAID_REFUND_STATUSES}
             THEN rr.refund_amount_paise ELSE 0 END
         ), 0) AS refunded_paise
       FROM orders o
       INNER JOIN return_requests rr ON rr.order_id = o.id
       WHERE o.placed_at >= ? AND o.placed_at <= ?
       GROUP BY DATE(o.placed_at)
       ORDER BY day ASC`,
      [range.from, range.to],
    );

    return { salesRows: rows, costRows, refundRows };
  }

  async countOrders(filters: {
    range: DateRange;
    status?: string;
    paymentMethod?: 'COD' | 'ONLINE';
    q?: string;
  }): Promise<number> {
    const { where, params } = this.orderWhere(filters);
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.id
       LEFT JOIN users u ON u.id = o.user_id
       ${where}`,
      params,
    );
    return Number(rows[0]?.total ?? 0);
  }

  async listOrders(filters: {
    range: DateRange;
    status?: string;
    paymentMethod?: 'COD' | 'ONLINE';
    q?: string;
    sort: string;
    limit: number;
    offset: number;
  }) {
    const { where, params } = this.orderWhere(filters);
    const orderBy = this.orderSortSql(filters.sort);
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
         o.id, o.order_number, o.status, o.placed_at, o.item_total_paise,
         o.delivery_fee_paise, o.tax_paise, o.discount_paise, o.grand_total_paise,
         p.method AS payment_method, p.status AS payment_status,
         u.full_name AS customer_name, u.phone AS customer_phone,
         (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
         (SELECT COALESCE(SUM(
            CASE WHEN oi.unit_cost_paise IS NOT NULL THEN oi.unit_cost_paise * oi.quantity ELSE 0 END
          ), 0) FROM order_items oi WHERE oi.order_id = o.id) AS cost_paise,
         (SELECT SUM(oi.unit_cost_paise IS NULL) FROM order_items oi WHERE oi.order_id = o.id) AS missing_cost_lines,
         (SELECT COALESCE(SUM(rr.refund_amount_paise), 0)
            FROM return_requests rr
           WHERE rr.order_id = o.id
             AND (rr.status IN ${PAID_RETURN_STATUSES} OR rr.refund_status IN ${PAID_REFUND_STATUSES})
         ) AS refunded_paise
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.id
       LEFT JOIN users u ON u.id = o.user_id
       ${where}
       ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, filters.limit, filters.offset],
    );
    return rows;
  }

  async getOrderDetail(orderId: string) {
    const [orders] = await this.db.query<RowDataPacket[]>(
      `SELECT
         o.id, o.order_number, o.status, o.placed_at, o.item_total_paise,
         o.delivery_fee_paise, o.tax_paise, o.discount_paise, o.grand_total_paise,
         p.method AS payment_method, p.status AS payment_status,
         u.full_name AS customer_name, u.phone AS customer_phone
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.id
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = ?
       LIMIT 1`,
      [orderId],
    );
    const order = orders[0];
    if (!order) return null;

    const [items] = await this.db.query<RowDataPacket[]>(
      `SELECT id, product_id, product_name, variant_label, quantity,
              unit_price_paise, unit_cost_paise, line_total_paise, is_local_shop
       FROM order_items
       WHERE order_id = ?
       ORDER BY product_name ASC`,
      [orderId],
    );

    const [refunds] = await this.db.query<RowDataPacket[]>(
      `SELECT ri.order_item_id, ri.quantity, ri.line_refund_paise, rr.status, rr.refund_status
       FROM return_request_items ri
       INNER JOIN return_requests rr ON rr.id = ri.return_request_id
       WHERE rr.order_id = ?
         AND rr.status <> 'REJECTED'`,
      [orderId],
    );

    return { order, items, refunds };
  }

  async countProducts(filters: { range: DateRange; q?: string }): Promise<number> {
    const { where, params } = this.productWhere(filters);
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM (
         SELECT oi.product_id
         FROM order_items oi
         INNER JOIN orders o ON o.id = oi.order_id
         ${where}
         GROUP BY oi.product_id
       ) t`,
      params,
    );
    return Number(rows[0]?.total ?? 0);
  }

  async listProducts(filters: {
    range: DateRange;
    q?: string;
    sort: string;
    limit: number;
    offset: number;
  }) {
    const { where, params } = this.productWhere(filters);
    const orderBy = this.productSortSql(filters.sort);
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
         oi.product_id,
         MAX(oi.product_name) AS product_name,
         SUM(oi.quantity) AS units_sold,
         SUM(oi.line_total_paise) AS revenue_paise,
         SUM(CASE WHEN oi.unit_cost_paise IS NOT NULL
           THEN oi.unit_cost_paise * oi.quantity ELSE 0 END) AS cost_paise,
         SUM(oi.unit_cost_paise IS NULL) AS missing_cost_lines
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       ${where}
       GROUP BY oi.product_id
       ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, filters.limit, filters.offset],
    );
    return rows;
  }

  async exportOrders(filters: {
    range: DateRange;
    status?: string;
    paymentMethod?: 'COD' | 'ONLINE';
    q?: string;
    sort: string;
    limit?: number;
  }) {
    return this.listOrders({
      ...filters,
      sort: filters.sort || 'latest',
      limit: filters.limit ?? 5000,
      offset: 0,
    });
  }

  private orderWhere(filters: {
    range: DateRange;
    status?: string;
    paymentMethod?: 'COD' | 'ONLINE';
    q?: string;
  }) {
    const clauses = ['o.placed_at >= ?', 'o.placed_at <= ?'];
    const params: unknown[] = [filters.range.from, filters.range.to];
    if (filters.status) {
      clauses.push('o.status = ?');
      params.push(filters.status);
    }
    if (filters.paymentMethod === 'COD') {
      clauses.push(`p.method = 'COD'`);
    } else if (filters.paymentMethod === 'ONLINE') {
      clauses.push(`p.method IS NOT NULL AND p.method <> 'COD'`);
    }
    if (filters.q) {
      clauses.push(
        `(o.order_number LIKE ? OR u.full_name LIKE ? OR u.phone LIKE ? OR EXISTS (
           SELECT 1 FROM order_items oi2
           WHERE oi2.order_id = o.id AND oi2.product_name LIKE ?
         ))`,
      );
      const like = `%${filters.q}%`;
      params.push(like, like, like, like);
    }
    return { where: `WHERE ${clauses.join(' AND ')}`, params };
  }

  private orderSortSql(sort: string): string {
    switch (sort) {
      case 'profit_desc':
        return `ORDER BY (CASE WHEN o.status = 'DELIVERED' THEN o.item_total_paise - COALESCE((
          SELECT SUM(rr.refund_amount_paise) FROM return_requests rr
          WHERE rr.order_id = o.id AND (rr.status IN ${PAID_RETURN_STATUSES} OR rr.refund_status IN ${PAID_REFUND_STATUSES})
        ), 0) - (SELECT COALESCE(SUM(CASE WHEN oi.unit_cost_paise IS NOT NULL THEN oi.unit_cost_paise * oi.quantity ELSE 0 END), 0)
          FROM order_items oi WHERE oi.order_id = o.id) ELSE NULL END) DESC, o.placed_at DESC`;
      case 'profit_asc':
        return `ORDER BY (CASE WHEN o.status = 'DELIVERED' THEN o.item_total_paise - COALESCE((
          SELECT SUM(rr.refund_amount_paise) FROM return_requests rr
          WHERE rr.order_id = o.id AND (rr.status IN ${PAID_RETURN_STATUSES} OR rr.refund_status IN ${PAID_REFUND_STATUSES})
        ), 0) - (SELECT COALESCE(SUM(CASE WHEN oi.unit_cost_paise IS NOT NULL THEN oi.unit_cost_paise * oi.quantity ELSE 0 END), 0)
          FROM order_items oi WHERE oi.order_id = o.id) ELSE NULL END) ASC, o.placed_at DESC`;
      case 'sales_desc':
        return 'ORDER BY o.item_total_paise DESC, o.placed_at DESC';
      case 'cost_desc':
        return `ORDER BY (SELECT COALESCE(SUM(CASE WHEN oi.unit_cost_paise IS NOT NULL THEN oi.unit_cost_paise * oi.quantity ELSE 0 END), 0)
          FROM order_items oi WHERE oi.order_id = o.id) DESC, o.placed_at DESC`;
      case 'latest':
      default:
        return 'ORDER BY o.placed_at DESC';
    }
  }

  private productWhere(filters: { range: DateRange; q?: string }) {
    const clauses = [
      `o.status = 'DELIVERED'`,
      'o.placed_at >= ?',
      'o.placed_at <= ?',
    ];
    const params: unknown[] = [filters.range.from, filters.range.to];
    if (filters.q) {
      clauses.push('oi.product_name LIKE ?');
      params.push(`%${filters.q}%`);
    }
    return { where: `WHERE ${clauses.join(' AND ')}`, params };
  }

  private productSortSql(sort: string): string {
    switch (sort) {
      case 'revenue_desc':
        return 'ORDER BY revenue_paise DESC';
      case 'profit_asc':
        return 'ORDER BY (revenue_paise - cost_paise) ASC';
      case 'margin_desc':
        return 'ORDER BY CASE WHEN revenue_paise = 0 THEN NULL ELSE (revenue_paise - cost_paise) / revenue_paise END DESC';
      case 'margin_asc':
        return 'ORDER BY CASE WHEN revenue_paise = 0 THEN NULL ELSE (revenue_paise - cost_paise) / revenue_paise END ASC';
      case 'units_desc':
        return 'ORDER BY units_sold DESC';
      case 'profit_desc':
      default:
        return 'ORDER BY (revenue_paise - cost_paise) DESC';
    }
  }
}
