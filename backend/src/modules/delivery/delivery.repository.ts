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
  p.amount_paise AS payment_amount_paise
`;

const JOB_JOINS = `
  FROM orders o
  INNER JOIN stores s ON s.id = o.store_id
  INNER JOIN addresses a ON a.id = o.address_id
  INNER JOIN users u ON u.id = o.user_id
  LEFT JOIN payments p ON p.order_id = o.id
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
      `SELECT COUNT(*) AS total
       ${JOB_JOINS}
       WHERE ${CLAIMABLE_ORDER_SQL}
         AND ${NO_ACTIVE_ASSIGNMENT}`,
    );
    return Number(rows[0]?.total ?? 0);
  }

  async countActiveForPartner(partnerId: string): Promise<number> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM delivery_assignments da
       WHERE da.delivery_partner_id = ?
         AND da.status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS')`,
      [partnerId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async countCompletedTodayForPartner(partnerId: string): Promise<number> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM delivery_assignments da
       WHERE da.delivery_partner_id = ?
         AND da.status = 'COMPLETED'
         AND DATE(da.completed_at) = CURDATE()`,
      [partnerId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async countAvailableJobs(): Promise<number> {
    return this.countAvailable();
  }

  async countActiveJobs(partnerId: string): Promise<number> {
    return this.countActiveForPartner(partnerId);
  }

  async countCompletedJobs(partnerId: string): Promise<number> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM delivery_assignments da
       WHERE da.delivery_partner_id = ?
         AND da.status = 'COMPLETED'`,
      [partnerId],
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
          p.amount_paise AS payment_amount_paise
       ${JOB_JOINS}
       WHERE ${CLAIMABLE_ORDER_SQL}
         AND ${NO_ACTIVE_ASSIGNMENT}
       ORDER BY o.placed_at ASC
       LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    return rows as DeliveryJobRow[];
  }

  async listActive(partnerId: string, limit: number, offset: number): Promise<DeliveryJobRow[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT ${JOB_SELECT}
       ${JOB_JOINS}
       INNER JOIN delivery_assignments da ON da.order_id = o.id
       WHERE da.delivery_partner_id = ?
         AND da.status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS')
       ORDER BY da.assigned_at DESC
       LIMIT ? OFFSET ?`,
      [partnerId, limit, offset],
    );
    return rows as DeliveryJobRow[];
  }

  async listCompleted(partnerId: string, limit: number, offset: number): Promise<DeliveryJobRow[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT ${JOB_SELECT}
       ${JOB_JOINS}
       INNER JOIN delivery_assignments da ON da.order_id = o.id
       WHERE da.delivery_partner_id = ?
         AND da.status = 'COMPLETED'
       ORDER BY da.completed_at DESC
       LIMIT ? OFFSET ?`,
      [partnerId, limit, offset],
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
    order_status: string;
  } | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT da.id, da.order_id, da.delivery_partner_id, da.status, o.status AS order_status
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
      order_status: string;
    }) ?? null;
  }

  async createAssignment(
    input: {
      orderId: string;
      partnerId: string;
      status: DeliveryAssignmentStatus;
      acceptedAt?: Date | null;
    },
    conn: PoolConnection,
  ): Promise<string> {
    const id = createId();
    const now = new Date();
    await conn.query(
      `INSERT INTO delivery_assignments (
         id, order_id, delivery_partner_id, status, assigned_at, accepted_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.orderId,
        input.partnerId,
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
