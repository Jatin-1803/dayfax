import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import type { OrderStatus } from '../orders/orders.schema.js';
import type { AdminListOrdersQuery } from './admin-orders.schema.js';

export interface AdminOrderListRow {
  id: string;
  order_number: string;
  user_id: string;
  store_id: string;
  status: OrderStatus;
  item_total_paise: number;
  delivery_fee_paise: number;
  tax_paise: number;
  discount_paise: number;
  grand_total_paise: number;
  currency: string;
  notes: string | null;
  placed_at: Date;
  delivered_at: Date | null;
  cancelled_at: Date | null;
  store_name: string;
  address_id: string;
  address_label: string | null;
  address_line1: string;
  address_city: string | null;
  payment_method: string | null;
  payment_status: string | null;
  customer_phone_country_code: string;
  customer_phone: string;
  customer_full_name: string | null;
  assignment_id: string | null;
  assignment_status: string | null;
  partner_id: string | null;
  partner_phone: string | null;
  partner_full_name: string | null;
}

const LIST_SELECT = `
  o.id, o.order_number, o.user_id, o.store_id, o.address_id, o.status,
  o.item_total_paise, o.delivery_fee_paise, o.tax_paise, o.discount_paise,
  o.grand_total_paise, o.currency, o.notes, o.placed_at, o.delivered_at, o.cancelled_at,
  s.name AS store_name,
  a.label AS address_label, a.line1 AS address_line1, a.city AS address_city,
  p.method AS payment_method, p.status AS payment_status,
  u.phone_country_code AS customer_phone_country_code,
  u.phone AS customer_phone,
  u.full_name AS customer_full_name,
  da.id AS assignment_id,
  da.status AS assignment_status,
  da.delivery_partner_id AS partner_id,
  partner.phone AS partner_phone,
  partner.full_name AS partner_full_name
`;

export class AdminOrdersRepository {
  constructor(private readonly db: Pool = getPool()) {}

  private buildFilters(query: AdminListOrdersQuery): {
    clauses: string[];
    params: unknown[];
  } {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (query.status) {
      clauses.push('o.status = ?');
      params.push(query.status);
    }
    if (query.storeId) {
      clauses.push('o.store_id = ?');
      params.push(query.storeId);
    }
    if (query.q) {
      const q = `%${query.q}%`;
      clauses.push(
        `(o.order_number LIKE ? OR u.phone LIKE ? OR u.full_name LIKE ? OR o.id = ?)`,
      );
      params.push(q, q, q, query.q);
    }

    return { clauses, params };
  }

  async countOrders(query: AdminListOrdersQuery): Promise<number> {
    const { clauses, params } = this.buildFilters(query);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM orders o
       INNER JOIN users u ON u.id = o.user_id
       ${where}`,
      params,
    );
    return Number(rows[0]?.total ?? 0);
  }

  async listOrders(
    query: AdminListOrdersQuery,
    limit: number,
    offset: number,
  ): Promise<AdminOrderListRow[]> {
    const { clauses, params } = this.buildFilters(query);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT ${LIST_SELECT}
       FROM orders o
       INNER JOIN stores s ON s.id = o.store_id
       INNER JOIN addresses a ON a.id = o.address_id
       INNER JOIN users u ON u.id = o.user_id
       LEFT JOIN payments p ON p.order_id = o.id
       LEFT JOIN delivery_assignments da
         ON da.order_id = o.id
         AND da.status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED')
         AND da.id = (
           SELECT da2.id FROM delivery_assignments da2
           WHERE da2.order_id = o.id
           ORDER BY da2.assigned_at DESC
           LIMIT 1
         )
       LEFT JOIN users partner ON partner.id = da.delivery_partner_id
       ${where}
       ORDER BY o.placed_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return rows as AdminOrderListRow[];
  }

  async findByIdOrNumber(idOrNumber: string): Promise<AdminOrderListRow | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT ${LIST_SELECT}
       FROM orders o
       INNER JOIN stores s ON s.id = o.store_id
       INNER JOIN addresses a ON a.id = o.address_id
       INNER JOIN users u ON u.id = o.user_id
       LEFT JOIN payments p ON p.order_id = o.id
       LEFT JOIN delivery_assignments da
         ON da.order_id = o.id
         AND da.id = (
           SELECT da2.id FROM delivery_assignments da2
           WHERE da2.order_id = o.id
           ORDER BY da2.assigned_at DESC
           LIMIT 1
         )
       LEFT JOIN users partner ON partner.id = da.delivery_partner_id
       WHERE o.id = ? OR o.order_number = ?
       LIMIT 1`,
      [idOrNumber, idOrNumber],
    );
    return (rows[0] as AdminOrderListRow) ?? null;
  }

  async findOrderStatus(
    orderId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<{ id: string; status: OrderStatus } | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, status FROM orders WHERE id = ? LIMIT 1 FOR UPDATE`,
      [orderId],
    );
    return (rows[0] as { id: string; status: OrderStatus }) ?? null;
  }
}
