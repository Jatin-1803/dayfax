import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';
import type { DeliveryAssignmentStatus } from './delivery.schema.js';

export interface DeliveryJobRow {
  order_id: string;
  order_number: string;
  order_status: string;
  store_id: string;
  store_name: string;
  store_phone_country_code: string | null;
  store_phone: string | null;
  store_address_line1: string | null;
  store_address_line2: string | null;
  store_landmark: string | null;
  store_city: string | null;
  store_pincode: string | null;
  store_latitude: number | null;
  store_longitude: number | null;
  address_id: string;
  address_label: string;
  address_full_name: string | null;
  address_line1: string;
  address_line2: string | null;
  address_landmark: string | null;
  address_city: string;
  address_state: string | null;
  address_pincode: string | null;
  address_latitude: number | null;
  address_longitude: number | null;
  grand_total_paise: number;
  currency: string;
  notes: string | null;
  placed_at: Date;
  assignment_id: string | null;
  assignment_status: DeliveryAssignmentStatus | null;
  assigned_at: Date | null;
  accepted_at: Date | null;
  completed_at: Date | null;
  customer_phone_country_code: string | null;
  customer_phone: string | null;
  payment_method: string | null;
  payment_status: string | null;
  payment_amount_paise: number | null;
  purpose: 'DELIVERY' | 'RETURN_PICKUP' | null;
  return_request_id: string | null;
  return_note: string | null;
}

export interface LocalShopPickupRow {
  source_order_id: string;
  id: string;
  name: string;
  phone_country_code: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  landmark: string | null;
  city: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
}

const JOB_SELECT = `
  o.id AS order_id,
  o.order_number,
  o.status AS order_status,
  o.store_id,
  s.name AS store_name,
  s.phone_country_code AS store_phone_country_code,
  s.phone AS store_phone,
  s.address_line1 AS store_address_line1,
  s.address_line2 AS store_address_line2,
  s.landmark AS store_landmark,
  s.city AS store_city,
  s.pincode AS store_pincode,
  s.latitude AS store_latitude,
  s.longitude AS store_longitude,
  o.address_id,
  a.label AS address_label,
  a.full_name AS address_full_name,
  a.line1 AS address_line1,
  a.line2 AS address_line2,
  a.landmark AS address_landmark,
  a.city AS address_city,
  a.state AS address_state,
  a.pincode AS address_pincode,
  a.latitude AS address_latitude,
  a.longitude AS address_longitude,
  o.grand_total_paise,
  o.currency,
  o.notes,
  o.placed_at,
  da.id AS assignment_id,
  da.status AS assignment_status,
  da.assigned_at,
  da.accepted_at,
  da.completed_at,
  u.phone_country_code AS customer_phone_country_code,
  u.phone AS customer_phone,
  p.method AS payment_method,
  p.status AS payment_status,
  p.amount_paise AS payment_amount_paise,
  da.purpose AS purpose,
  da.return_request_id AS return_request_id,
  rr.customer_note AS return_note
`;

const JOB_JOINS = `
  FROM orders o
  INNER JOIN stores s ON s.id = o.store_id
  INNER JOIN addresses a ON a.id = o.address_id
  INNER JOIN users u ON u.id = o.user_id
  LEFT JOIN payments p ON p.order_id = o.id
`;

const RETURN_NOTE_JOIN = `
  LEFT JOIN return_requests rr ON rr.id = da.return_request_id
`;

/** Orders a partner may accept. Pending COD, paid-but-unaccepted online, or legacy unassigned confirmed orders. */
export const CLAIMABLE_ORDER_SQL = `(
  (
    o.status = 'PENDING'
    AND p.method = 'COD'
    AND p.status = 'PENDING'
  )
  OR (
    o.status = 'PENDING'
    AND p.method IN ('UPI', 'CARD', 'WALLET')
    AND p.status = 'CAPTURED'
  )
  OR o.status IN ('CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP')
)`;

/** Local-shop half of a mixed checkout is delivered with the in-house order. */
const HIDE_GROUPED_LOCAL = `
  NOT (o.is_local_shop = 1 AND o.checkout_group_id IS NOT NULL)
`;

const NO_ACTIVE_ASSIGNMENT = `
  NOT EXISTS (
    SELECT 1 FROM delivery_assignments da_active
    WHERE da_active.order_id = o.id
      AND da_active.status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS')
  )
`;

export class DeliveryRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async countAvailable(): Promise<number> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
         (
           SELECT COUNT(*)
           ${JOB_JOINS}
           WHERE ${CLAIMABLE_ORDER_SQL}
             AND ${NO_ACTIVE_ASSIGNMENT}
             AND ${HIDE_GROUPED_LOCAL}
         ) + (
           SELECT COUNT(*)
           FROM return_requests rr
           INNER JOIN orders o ON o.id = rr.order_id
           WHERE rr.status = 'APPROVED'
             AND NOT EXISTS (
               SELECT 1 FROM delivery_assignments da_pick
               WHERE da_pick.return_request_id = rr.id
                 AND da_pick.status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS')
             )
         ) AS total`,
    );
    return Number(rows[0]?.total ?? 0);
  }

  async countActiveForPartner(partnerId: string): Promise<number> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM delivery_assignments da
       INNER JOIN orders o ON o.id = da.order_id
       WHERE da.delivery_partner_id = ?
         AND da.status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS')
         AND ${HIDE_GROUPED_LOCAL}`,
      [partnerId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async getDayStats(
    partnerId: string,
    date: string,
  ): Promise<{
    ordersDelivered: number;
    cancelled: number;
    returns: number;
    cashCollectedPaise: number;
    upiCollectedPaise: number;
  }> {
    const istDay = (column: string) => `DATE(CONVERT_TZ(${column}, '+00:00', '+05:30'))`;
    const [countRows] = await this.db.query<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(
           CASE
             WHEN da.status = 'COMPLETED'
              AND COALESCE(da.purpose, 'DELIVERY') = 'DELIVERY'
              AND ${istDay('da.completed_at')} = ?
             THEN 1 ELSE 0
           END
         ), 0) AS orders_delivered,
         COALESCE(SUM(
           CASE
             WHEN da.status = 'CANCELLED'
              AND ${istDay('da.updated_at')} = ?
             THEN 1 ELSE 0
           END
         ), 0) AS cancelled,
         COALESCE(SUM(
           CASE
             WHEN da.status = 'COMPLETED'
              AND da.purpose = 'RETURN_PICKUP'
              AND ${istDay('da.completed_at')} = ?
             THEN 1 ELSE 0
           END
         ), 0) AS returns_count
       FROM delivery_assignments da
       INNER JOIN orders o ON o.id = da.order_id
       WHERE da.delivery_partner_id = ?
         AND ${HIDE_GROUPED_LOCAL}`,
      [date, date, date, partnerId],
    );
    const [payRows] = await this.db.query<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(
           CASE
             WHEN p.method = 'COD'
              AND (p.verification_source = 'cash' OR p.provider = 'cash')
             THEN p.amount_paise
             ELSE 0
           END
         ), 0) AS cash_collected_paise,
         COALESCE(SUM(
           CASE
             WHEN p.method = 'COD'
              AND COALESCE(p.provider, '') <> 'cash'
              AND COALESCE(p.verification_source, '') <> 'cash'
              AND COALESCE(p.provider, '') <> 'card'
              AND (
                p.provider IN ('razorpay_qr', 'upi')
                OR p.verification_source IN ('webhook', 'manual_check')
              )
             THEN p.amount_paise
             ELSE 0
           END
         ), 0) AS upi_collected_paise
       FROM payments p
       INNER JOIN orders o ON o.id = p.order_id
       WHERE p.status = 'CAPTURED'
         AND ${istDay('p.paid_at')} = ?
         AND ${HIDE_GROUPED_LOCAL}
         AND EXISTS (
           SELECT 1
           FROM delivery_assignments da
           WHERE da.order_id = p.order_id
             AND da.delivery_partner_id = ?
             AND da.status = 'COMPLETED'
             AND COALESCE(da.purpose, 'DELIVERY') = 'DELIVERY'
         )`,
      [date, partnerId],
    );
    const counts = countRows[0];
    const payments = payRows[0];
    return {
      ordersDelivered: Number(counts?.orders_delivered ?? 0),
      cancelled: Number(counts?.cancelled ?? 0),
      returns: Number(counts?.returns_count ?? 0),
      cashCollectedPaise: Number(payments?.cash_collected_paise ?? 0),
      upiCollectedPaise: Number(payments?.upi_collected_paise ?? 0),
    };
  }

  /** Local-shop sibling of a merged checkout, keyed by the partner-visible order id. */
  async listLocalShopsByOrderIds(orderIds: string[]): Promise<Map<string, LocalShopPickupRow>> {
    const uniqueIds = [...new Set(orderIds.filter(Boolean))];
    if (uniqueIds.length === 0) return new Map();

    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
         o.id AS source_order_id,
         ls.id,
         ls.name,
         ls.phone_country_code,
         ls.phone,
         ls.address_line1,
         ls.address_line2,
         ls.landmark,
         ls.city,
         ls.pincode,
         ls.latitude,
         ls.longitude
       FROM orders o
       INNER JOIN orders local_o
         ON local_o.checkout_group_id = o.checkout_group_id
        AND local_o.is_local_shop = 1
        AND local_o.id <> o.id
        AND local_o.status <> 'CANCELLED'
       INNER JOIN stores ls ON ls.id = local_o.store_id
       WHERE o.id IN (?)
         AND o.checkout_group_id IS NOT NULL
       ORDER BY local_o.placed_at ASC`,
      [uniqueIds],
    );

    const byOrderId = new Map<string, LocalShopPickupRow>();
    for (const row of rows) {
      const sourceOrderId = row.source_order_id as string;
      if (byOrderId.has(sourceOrderId)) continue;
      byOrderId.set(sourceOrderId, {
        source_order_id: sourceOrderId,
        id: row.id as string,
        name: row.name as string,
        phone_country_code: (row.phone_country_code as string | null) ?? null,
        phone: (row.phone as string | null) ?? null,
        address_line1: (row.address_line1 as string | null) ?? null,
        address_line2: (row.address_line2 as string | null) ?? null,
        landmark: (row.landmark as string | null) ?? null,
        city: (row.city as string | null) ?? null,
        pincode: (row.pincode as string | null) ?? null,
        latitude: row.latitude != null ? Number(row.latitude) : null,
        longitude: row.longitude != null ? Number(row.longitude) : null,
      });
    }
    return byOrderId;
  }

  async countAvailableJobs(): Promise<number> {
    return this.countAvailable();
  }

  async countActiveJobs(partnerId: string): Promise<number> {
    return this.countActiveForPartner(partnerId);
  }

  async countCompletedJobs(partnerId: string, date?: string): Promise<number> {
    const dateClause = date
      ? `AND DATE(CONVERT_TZ(da.completed_at, '+00:00', '+05:30')) = ?`
      : '';
    const params = date ? [partnerId, date] : [partnerId];
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM delivery_assignments da
       INNER JOIN orders o ON o.id = da.order_id
       WHERE da.delivery_partner_id = ?
         AND da.status = 'COMPLETED'
         AND ${HIDE_GROUPED_LOCAL}
         ${dateClause}`,
      params,
    );
    return Number(rows[0]?.total ?? 0);
  }

  async listAvailable(limit: number, offset: number): Promise<DeliveryJobRow[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
          o.id AS order_id,
          o.order_number,
          o.status AS order_status,
          o.store_id,
          s.name AS store_name,
          s.phone_country_code AS store_phone_country_code,
          s.phone AS store_phone,
          s.address_line1 AS store_address_line1,
          s.address_line2 AS store_address_line2,
          s.landmark AS store_landmark,
          s.city AS store_city,
          s.pincode AS store_pincode,
          s.latitude AS store_latitude,
          s.longitude AS store_longitude,
          o.address_id,
          a.label AS address_label,
          a.full_name AS address_full_name,
          a.line1 AS address_line1,
          a.line2 AS address_line2,
          a.landmark AS address_landmark,
          a.city AS address_city,
          a.state AS address_state,
          a.pincode AS address_pincode,
          a.latitude AS address_latitude,
          a.longitude AS address_longitude,
          o.grand_total_paise,
          o.currency,
          o.notes,
          o.placed_at,
          NULL AS assignment_id,
          NULL AS assignment_status,
          NULL AS assigned_at,
          NULL AS accepted_at,
          NULL AS completed_at,
          p.method AS payment_method,
          p.status AS payment_status,
          p.amount_paise AS payment_amount_paise,
          'DELIVERY' AS purpose,
          NULL AS return_request_id,
          NULL AS return_note
       ${JOB_JOINS}
       WHERE ${CLAIMABLE_ORDER_SQL}
         AND ${NO_ACTIVE_ASSIGNMENT}
         AND ${HIDE_GROUPED_LOCAL}
       UNION ALL
       SELECT
          o.id AS order_id,
          o.order_number,
          o.status AS order_status,
          o.store_id,
          s.name AS store_name,
          s.phone_country_code AS store_phone_country_code,
          s.phone AS store_phone,
          s.address_line1 AS store_address_line1,
          s.address_line2 AS store_address_line2,
          s.landmark AS store_landmark,
          s.city AS store_city,
          s.pincode AS store_pincode,
          s.latitude AS store_latitude,
          s.longitude AS store_longitude,
          o.address_id,
          a.label AS address_label,
          a.full_name AS address_full_name,
          a.line1 AS address_line1,
          a.line2 AS address_line2,
          a.landmark AS address_landmark,
          a.city AS address_city,
          a.state AS address_state,
          a.pincode AS address_pincode,
          a.latitude AS address_latitude,
          a.longitude AS address_longitude,
          o.grand_total_paise,
          o.currency,
          rr.customer_note AS notes,
          rr.created_at AS placed_at,
          NULL AS assignment_id,
          NULL AS assignment_status,
          NULL AS assigned_at,
          NULL AS accepted_at,
          NULL AS completed_at,
          p.method AS payment_method,
          p.status AS payment_status,
          p.amount_paise AS payment_amount_paise,
          'RETURN_PICKUP' AS purpose,
          rr.id AS return_request_id,
          rr.customer_note AS return_note
       FROM return_requests rr
       INNER JOIN orders o ON o.id = rr.order_id
       INNER JOIN stores s ON s.id = o.store_id
       INNER JOIN addresses a ON a.id = o.address_id
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE rr.status = 'APPROVED'
         AND NOT EXISTS (
           SELECT 1 FROM delivery_assignments da_pick
           WHERE da_pick.return_request_id = rr.id
             AND da_pick.status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS')
         )
       ORDER BY placed_at ASC
       LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    return rows as DeliveryJobRow[];
  }

  async findAvailableReturnJob(returnRequestId: string): Promise<DeliveryJobRow | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
          o.id AS order_id,
          o.order_number,
          o.status AS order_status,
          o.store_id,
          s.name AS store_name,
          s.phone_country_code AS store_phone_country_code,
          s.phone AS store_phone,
          s.address_line1 AS store_address_line1,
          s.address_line2 AS store_address_line2,
          s.landmark AS store_landmark,
          s.city AS store_city,
          s.pincode AS store_pincode,
          s.latitude AS store_latitude,
          s.longitude AS store_longitude,
          o.address_id,
          a.label AS address_label,
          a.full_name AS address_full_name,
          a.line1 AS address_line1,
          a.line2 AS address_line2,
          a.landmark AS address_landmark,
          a.city AS address_city,
          a.state AS address_state,
          a.pincode AS address_pincode,
          a.latitude AS address_latitude,
          a.longitude AS address_longitude,
          o.grand_total_paise,
          o.currency,
          rr.customer_note AS notes,
          rr.created_at AS placed_at,
          NULL AS assignment_id,
          NULL AS assignment_status,
          NULL AS assigned_at,
          NULL AS accepted_at,
          NULL AS completed_at,
          u.phone_country_code AS customer_phone_country_code,
          u.phone AS customer_phone,
          p.method AS payment_method,
          p.status AS payment_status,
          p.amount_paise AS payment_amount_paise,
          'RETURN_PICKUP' AS purpose,
          rr.id AS return_request_id,
          rr.customer_note AS return_note
       FROM return_requests rr
       INNER JOIN orders o ON o.id = rr.order_id
       INNER JOIN stores s ON s.id = o.store_id
       INNER JOIN addresses a ON a.id = o.address_id
       INNER JOIN users u ON u.id = o.user_id
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE rr.id = ?
         AND rr.status = 'APPROVED'
         AND NOT EXISTS (
           SELECT 1 FROM delivery_assignments da_pick
           WHERE da_pick.return_request_id = rr.id
             AND da_pick.status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS')
         )
       LIMIT 1`,
      [returnRequestId],
    );
    return (rows[0] as DeliveryJobRow) ?? null;
  }

  async findReturnJobForPartner(
    returnRequestId: string,
    partnerId: string,
  ): Promise<DeliveryJobRow | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT ${JOB_SELECT}
       ${JOB_JOINS}
       INNER JOIN delivery_assignments da ON da.order_id = o.id
       ${RETURN_NOTE_JOIN}
       WHERE da.return_request_id = ?
         AND da.delivery_partner_id = ?
       ORDER BY da.assigned_at DESC
       LIMIT 1`,
      [returnRequestId, partnerId],
    );
    return (rows[0] as DeliveryJobRow) ?? null;
  }

  async listActive(partnerId: string, limit: number, offset: number): Promise<DeliveryJobRow[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT ${JOB_SELECT}
       ${JOB_JOINS}
       INNER JOIN delivery_assignments da ON da.order_id = o.id
       ${RETURN_NOTE_JOIN}
       WHERE da.delivery_partner_id = ?
         AND da.status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS')
         AND ${HIDE_GROUPED_LOCAL}
       ORDER BY da.assigned_at DESC
       LIMIT ? OFFSET ?`,
      [partnerId, limit, offset],
    );
    return rows as DeliveryJobRow[];
  }

  async listCompleted(
    partnerId: string,
    limit: number,
    offset: number,
    date?: string,
  ): Promise<DeliveryJobRow[]> {
    const dateClause = date
      ? `AND DATE(CONVERT_TZ(da.completed_at, '+00:00', '+05:30')) = ?`
      : '';
    const params = date
      ? [partnerId, date, limit, offset]
      : [partnerId, limit, offset];
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT ${JOB_SELECT}
       ${JOB_JOINS}
       INNER JOIN delivery_assignments da ON da.order_id = o.id
       ${RETURN_NOTE_JOIN}
       WHERE da.delivery_partner_id = ?
         AND da.status = 'COMPLETED'
         AND ${HIDE_GROUPED_LOCAL}
         ${dateClause}
       ORDER BY da.completed_at DESC
       LIMIT ? OFFSET ?`,
      params,
    );
    return rows as DeliveryJobRow[];
  }

  async findJobByAssignmentId(
    assignmentId: string,
    partnerId: string,
    isAdmin: boolean,
  ): Promise<DeliveryJobRow | null> {
    const partnerClause = isAdmin ? '' : 'AND da.delivery_partner_id = ?';
    const params = isAdmin ? [assignmentId] : [assignmentId, partnerId];
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT ${JOB_SELECT}
       ${JOB_JOINS}
       INNER JOIN delivery_assignments da ON da.order_id = o.id
       ${RETURN_NOTE_JOIN}
       WHERE da.id = ?
         ${partnerClause}
       LIMIT 1`,
      params,
    );
    return (rows[0] as DeliveryJobRow) ?? null;
  }

  async findJobByOrderIdOrNumber(
    idOrOrderId: string,
    partnerId: string,
    isAdmin: boolean,
  ): Promise<DeliveryJobRow | null> {
    const partnerClause = isAdmin
      ? ''
      : `AND (
           da.delivery_partner_id = ?
           OR (
             da.id IS NULL
             AND ${CLAIMABLE_ORDER_SQL}
             AND ${NO_ACTIVE_ASSIGNMENT}
           )
         )`;
    const params = isAdmin ? [idOrOrderId, idOrOrderId] : [idOrOrderId, idOrOrderId, partnerId];
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT ${JOB_SELECT}
       ${JOB_JOINS}
       LEFT JOIN delivery_assignments da ON da.order_id = o.id
         AND da.status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED')
       ${RETURN_NOTE_JOIN}
       WHERE (o.id = ? OR o.order_number = ?)
         ${partnerClause}
       ORDER BY da.assigned_at DESC
       LIMIT 1`,
      params,
    );
    return (rows[0] as DeliveryJobRow) ?? null;
  }

  async findActiveAssignmentForOrder(
    orderId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<{
    id: string;
    order_id: string;
    delivery_partner_id: string;
    status: DeliveryAssignmentStatus;
  } | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, order_id, delivery_partner_id, status
       FROM delivery_assignments
       WHERE order_id = ?
         AND status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS')
       LIMIT 1
       FOR UPDATE`,
      [orderId],
    );
    return (rows[0] as {
      id: string;
      order_id: string;
      delivery_partner_id: string;
      status: DeliveryAssignmentStatus;
    }) ?? null;
  }

  async findOrderForClaim(
    orderId: string,
    conn: PoolConnection,
  ): Promise<{ id: string; status: string; order_number: string } | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, status, order_number
       FROM orders
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [orderId],
    );
    return (rows[0] as { id: string; status: string; order_number: string }) ?? null;
  }

  async findOrderNumber(
    orderId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<{ order_number: string } | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT order_number FROM orders WHERE id = ? LIMIT 1`,
      [orderId],
    );
    return (rows[0] as { order_number: string }) ?? null;
  }

  async insertAcceptanceLock(
    input: { orderId: string; assignmentId: string; partnerId: string; acceptedAt: Date },
    conn: PoolConnection,
  ): Promise<void> {
    await conn.query(
      `INSERT INTO order_acceptance_locks (
         order_id, assignment_id, delivery_partner_id, accepted_at
       ) VALUES (?, ?, ?, ?)`,
      [input.orderId, input.assignmentId, input.partnerId, input.acceptedAt],
    );
  }

  async deleteAcceptanceLock(orderId: string, conn: PoolConnection): Promise<void> {
    await conn.query(`DELETE FROM order_acceptance_locks WHERE order_id = ?`, [orderId]);
  }

  async completeActiveDeliveryAssignment(
    orderId: string,
    note: string,
    conn: PoolConnection,
  ): Promise<{ id: string; delivery_partner_id: string } | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, delivery_partner_id
       FROM delivery_assignments
       WHERE order_id = ?
         AND purpose = 'DELIVERY'
         AND status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS')
       LIMIT 1
       FOR UPDATE`,
      [orderId],
    );
    const assignment = rows[0] as { id: string; delivery_partner_id: string } | undefined;
    if (!assignment) return null;

    const now = new Date();
    await this.updateAssignmentStatus(
      assignment.id,
      { status: 'COMPLETED', completedAt: now },
      conn,
    );
    await this.addStatusHistory(
      { assignmentId: assignment.id, status: 'COMPLETED', note },
      conn,
    );
    await this.deleteAcceptanceLock(orderId, conn);
    return assignment;
  }

  /** Close partner jobs whose order was already marked delivered elsewhere. */
  async completeStaleDeliveredAssignments(partnerId?: string): Promise<void> {
    const partnerClause = partnerId ? 'AND da.delivery_partner_id = ?' : '';
    const params = partnerId ? [partnerId] : [];
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT da.id, da.order_id, o.delivered_at
       FROM delivery_assignments da
       INNER JOIN orders o ON o.id = da.order_id
       WHERE da.purpose = 'DELIVERY'
         AND da.status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS')
         AND o.status = 'DELIVERED'
         ${partnerClause}`,
      params,
    );
    if (rows.length === 0) return;

    for (const row of rows) {
      const assignmentId = row.id as string;
      const orderId = row.order_id as string;
      const completedAt = (row.delivered_at as Date | null) ?? new Date();
      await this.db.query(
        `UPDATE delivery_assignments
         SET status = 'COMPLETED', completed_at = ?
         WHERE id = ?
           AND status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS')`,
        [completedAt, assignmentId],
      );
      await this.db.query(
        `INSERT INTO delivery_status_history (
           id, delivery_assignment_id, status, note
         ) VALUES (?, ?, 'COMPLETED', ?)`,
        [createId(), assignmentId, 'Completed after admin marked the order delivered'],
      );
      await this.db.query(`DELETE FROM order_acceptance_locks WHERE order_id = ?`, [orderId]);
    }
  }

  async cancelActiveAssignments(orderId: string, conn: PoolConnection): Promise<void> {
    await conn.query(
      `UPDATE delivery_assignments
       SET status = 'CANCELLED'
       WHERE order_id = ?
         AND status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS')`,
      [orderId],
    );
  }

  async findAssignmentByIdForPartner(
    assignmentId: string,
    partnerId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<{
    id: string;
    order_id: string;
    delivery_partner_id: string;
    status: DeliveryAssignmentStatus;
    purpose: 'DELIVERY' | 'RETURN_PICKUP';
    return_request_id: string | null;
    order_status: string;
  } | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT da.id, da.order_id, da.delivery_partner_id, da.status, da.purpose,
              da.return_request_id, o.status AS order_status
       FROM delivery_assignments da
       INNER JOIN orders o ON o.id = da.order_id
       WHERE da.id = ?
         AND da.delivery_partner_id = ?
       LIMIT 1
       FOR UPDATE`,
      [assignmentId, partnerId],
    );
    return (rows[0] as {
      id: string;
      order_id: string;
      delivery_partner_id: string;
      status: DeliveryAssignmentStatus;
      purpose: 'DELIVERY' | 'RETURN_PICKUP';
      return_request_id: string | null;
      order_status: string;
    }) ?? null;
  }

  async createAssignment(
    input: {
      orderId: string;
      partnerId: string;
      status: DeliveryAssignmentStatus;
      acceptedAt?: Date | null;
      purpose?: 'DELIVERY' | 'RETURN_PICKUP';
      returnRequestId?: string | null;
    },
    conn: PoolConnection,
  ): Promise<string> {
    const id = createId();
    const now = new Date();
    await conn.query(
      `INSERT INTO delivery_assignments (
         id, order_id, delivery_partner_id, purpose, return_request_id, status, assigned_at, accepted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.orderId,
        input.partnerId,
        input.purpose ?? 'DELIVERY',
        input.returnRequestId ?? null,
        input.status,
        now,
        input.acceptedAt ?? null,
      ],
    );
    return id;
  }

  async updateAssignmentStatus(
    assignmentId: string,
    fields: {
      status: DeliveryAssignmentStatus;
      acceptedAt?: Date | null;
      completedAt?: Date | null;
    },
    conn: PoolConnection,
  ): Promise<void> {
    const sets = ['status = ?'];
    const values: unknown[] = [fields.status];
    if (fields.acceptedAt !== undefined) {
      sets.push('accepted_at = ?');
      values.push(fields.acceptedAt);
    }
    if (fields.completedAt !== undefined) {
      sets.push('completed_at = ?');
      values.push(fields.completedAt);
    }
    await conn.query(
      `UPDATE delivery_assignments SET ${sets.join(', ')} WHERE id = ?`,
      [...values, assignmentId],
    );
  }

  async addStatusHistory(
    input: {
      assignmentId: string;
      status: string;
      latitude?: number | null;
      longitude?: number | null;
      note?: string | null;
    },
    conn: PoolConnection,
  ): Promise<void> {
    await conn.query(
      `INSERT INTO delivery_status_history (
         id, delivery_assignment_id, status, latitude, longitude, note
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        createId(),
        input.assignmentId,
        input.status,
        input.latitude ?? null,
        input.longitude ?? null,
        input.note ?? null,
      ],
    );
  }

  async updateOrderStatus(
    orderId: string,
    status: string,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.query(`UPDATE orders SET status = ? WHERE id = ?`, [status, orderId]);
  }

  async markOrderDelivered(orderId: string, conn: PoolConnection): Promise<void> {
    await conn.query(
      `UPDATE orders SET status = 'DELIVERED', delivered_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [orderId],
    );
  }
}
