import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';
import type { OrderStatus } from './orders.schema.js';

function mapZoneFeeRow(row: RowDataPacket): ZoneFeeRow {
  return {
    id: row.id as string,
    delivery_fee_paise: Number(row.delivery_fee_paise),
    min_order_paise: Number(row.min_order_paise),
    free_delivery_above_paise:
      row.free_delivery_above_paise != null ? Number(row.free_delivery_above_paise) : null,
    eta_minutes: Number(row.eta_minutes),
    center_latitude: row.center_latitude != null ? Number(row.center_latitude) : null,
    center_longitude: row.center_longitude != null ? Number(row.center_longitude) : null,
  };
}

export interface OrderRow {
  id: string;
  order_number: string;
  user_id: string;
  store_id: string;
  service_area_id: string;
  delivery_zone_id: string | null;
  address_id: string;
  status: OrderStatus;
  item_total_paise: number;
  delivery_fee_paise: number;
  tax_paise: number;
  discount_paise: number;
  grand_total_paise: number;
  currency: string;
  notes: string | null;
  delivery_otp?: string | null;
  delivery_otp_attempts?: number;
  placed_at: Date;
  delivered_at: Date | null;
  cancelled_at: Date | null;
  store_name?: string;
  address_label?: string;
  address_line1?: string;
  address_city?: string;
  payment_method?: string | null;
  payment_status?: string | null;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  variant_label: string;
  unit_price_paise: number;
  quantity: number;
  line_total_paise: number;
  product_image_url?: string | null;
}

export interface StatusHistoryRow {
  id: string;
  order_id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: Date;
}

export interface ZoneFeeRow {
  id: string;
  delivery_fee_paise: number;
  min_order_paise: number;
  free_delivery_above_paise: number | null;
  eta_minutes: number;
  center_latitude: number | null;
  center_longitude: number | null;
}

export interface DeliveryFeeSlabRow {
  id: string;
  delivery_zone_id: string;
  from_km: number;
  to_km: number | null;
  fee_paise: number;
}

export class OrdersRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async findAddressForUser(
    addressId: string,
    userId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<{
    id: string;
    service_area_id: string | null;
    delivery_zone_id: string | null;
    label: string;
    line1: string;
    city: string;
    latitude: number | null;
    longitude: number | null;
  } | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, service_area_id, delivery_zone_id, label, line1, city, latitude, longitude
       FROM addresses
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [addressId, userId],
    );
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      id: row.id as string,
      service_area_id: (row.service_area_id as string | null) ?? null,
      delivery_zone_id: (row.delivery_zone_id as string | null) ?? null,
      label: row.label as string,
      line1: row.line1 as string,
      city: row.city as string,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
    };
  }

  async findZone(
    zoneId: string | null,
    serviceAreaId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<ZoneFeeRow | null> {
    const selectSql = `SELECT dz.id, dz.delivery_fee_paise, dz.min_order_paise,
              dz.free_delivery_above_paise, dz.eta_minutes,
              l.latitude AS center_latitude, l.longitude AS center_longitude
       FROM delivery_zones dz
       INNER JOIN service_areas sa ON sa.id = dz.service_area_id
       INNER JOIN locations l ON l.id = sa.location_id`;

    if (zoneId) {
      const [rows] = await conn.query<RowDataPacket[]>(
        `${selectSql}
         WHERE dz.id = ? AND dz.deleted_at IS NULL AND dz.is_active = 1
         LIMIT 1`,
        [zoneId],
      );
      if (rows[0]) {
        return mapZoneFeeRow(rows[0]);
      }
    }

    const [rows] = await conn.query<RowDataPacket[]>(
      `${selectSql}
       WHERE dz.service_area_id = ? AND dz.deleted_at IS NULL AND dz.is_active = 1
       ORDER BY dz.created_at ASC
       LIMIT 1`,
      [serviceAreaId],
    );
    return rows[0] ? mapZoneFeeRow(rows[0]) : null;
  }

  async listFeeSlabs(
    zoneId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<DeliveryFeeSlabRow[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, delivery_zone_id, from_km, to_km, fee_paise
       FROM delivery_fee_slabs
       WHERE delivery_zone_id = ? AND deleted_at IS NULL
       ORDER BY from_km ASC, fee_paise ASC`,
      [zoneId],
    );
    return rows.map((row) => ({
      id: row.id as string,
      delivery_zone_id: row.delivery_zone_id as string,
      from_km: Number(row.from_km),
      to_km: row.to_km != null ? Number(row.to_km) : null,
      fee_paise: Number(row.fee_paise),
    }));
  }

  async createOrder(
    input: {
      orderNumber: string;
      userId: string;
      storeId: string;
      serviceAreaId: string;
      deliveryZoneId: string | null;
      addressId: string;
      status: OrderStatus;
      itemTotalPaise: number;
      deliveryFeePaise: number;
      taxPaise: number;
      discountPaise: number;
      grandTotalPaise: number;
      notes?: string;
    },
    conn: PoolConnection,
  ): Promise<string> {
    const id = createId();
    await conn.query(
      `INSERT INTO orders (
         id, order_number, user_id, store_id, service_area_id, delivery_zone_id, address_id,
         status, item_total_paise, delivery_fee_paise, tax_paise, discount_paise,
         grand_total_paise, currency, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?)`,
      [
        id,
        input.orderNumber,
        input.userId,
        input.storeId,
        input.serviceAreaId,
        input.deliveryZoneId,
        input.addressId,
        input.status,
        input.itemTotalPaise,
        input.deliveryFeePaise,
        input.taxPaise,
        input.discountPaise,
        input.grandTotalPaise,
        input.notes ?? null,
      ],
    );
    return id;
  }

  async createOrderItem(
    input: {
      orderId: string;
      productId: string;
      variantId: string;
      productName: string;
      variantLabel: string;
      unitPricePaise: number;
      quantity: number;
      lineTotalPaise: number;
    },
    conn: PoolConnection,
  ): Promise<void> {
    await conn.query(
      `INSERT INTO order_items (
         id, order_id, product_id, variant_id, product_name, variant_label,
         unit_price_paise, quantity, line_total_paise
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        createId(),
        input.orderId,
        input.productId,
        input.variantId,
        input.productName,
        input.variantLabel,
        input.unitPricePaise,
        input.quantity,
        input.lineTotalPaise,
      ],
    );
  }

  async addStatusHistory(
    input: {
      orderId: string;
      fromStatus: string | null;
      toStatus: string;
      changedByUserId?: string;
      note?: string;
    },
    conn: PoolConnection,
  ): Promise<void> {
    await conn.query(
      `INSERT INTO order_status_history (
         id, order_id, from_status, to_status, changed_by_user_id, note
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        createId(),
        input.orderId,
        input.fromStatus,
        input.toStatus,
        input.changedByUserId ?? null,
        input.note ?? null,
      ],
    );
  }

  async createPayment(
    input: {
      orderId: string;
      method: 'COD' | 'UPI' | 'CARD' | 'WALLET';
      status: 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
      amountPaise: number;
      provider?: string;
      providerRef?: string | null;
    },
    conn: PoolConnection,
  ): Promise<string> {
    const id = createId();
    await conn.query(
      `INSERT INTO payments (
         id, order_id, method, status, amount_paise, currency, provider, provider_ref
       ) VALUES (?, ?, ?, ?, ?, 'INR', ?, ?)`,
      [
        id,
        input.orderId,
        input.method,
        input.status,
        input.amountPaise,
        input.provider ?? (input.method === 'COD' ? 'cod_stub' : 'razorpay'),
        input.providerRef ?? null,
      ],
    );
    return id;
  }

  async findPaymentByOrderId(
    orderId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<{
    id: string;
    order_id: string;
    method: string;
    status: string;
    amount_paise: number;
    provider: string | null;
    provider_ref: string | null;
  } | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, order_id, method, status, amount_paise, provider, provider_ref
       FROM payments
       WHERE order_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderId],
    );
    return (rows[0] as {
      id: string;
      order_id: string;
      method: string;
      status: string;
      amount_paise: number;
      provider: string | null;
      provider_ref: string | null;
    }) ?? null;
  }

  async updatePayment(
    paymentId: string,
    fields: {
      status?: string;
      providerRef?: string | null;
      paidAt?: Date | null;
      razorpayOrderId?: string | null;
      razorpayPaymentId?: string | null;
      razorpayQrId?: string | null;
      provider?: string | null;
      verificationSource?: 'checkout' | 'webhook' | 'manual_check' | 'cash' | null;
    },
    conn: Pool | PoolConnection = this.db,
  ): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (fields.status !== undefined) {
      sets.push('status = ?');
      values.push(fields.status);
    }
    if (fields.providerRef !== undefined) {
      sets.push('provider_ref = ?');
      values.push(fields.providerRef);
    }
    if (fields.paidAt !== undefined) {
      sets.push('paid_at = ?');
      values.push(fields.paidAt);
    }
    if (fields.razorpayOrderId !== undefined) {
      sets.push('razorpay_order_id = ?');
      values.push(fields.razorpayOrderId);
    }
    if (fields.razorpayPaymentId !== undefined) {
      sets.push('razorpay_payment_id = ?');
      values.push(fields.razorpayPaymentId);
    }
    if (fields.razorpayQrId !== undefined) {
      sets.push('razorpay_qr_id = ?');
      values.push(fields.razorpayQrId);
    }
    if (fields.provider !== undefined) {
      sets.push('provider = ?');
      values.push(fields.provider);
    }
    if (fields.verificationSource !== undefined) {
      sets.push('verification_source = ?');
      values.push(fields.verificationSource);
    }
    if (sets.length === 0) return;
    await conn.query(`UPDATE payments SET ${sets.join(', ')} WHERE id = ?`, [
      ...values,
      paymentId,
    ]);
  }

  async updateOrderStatus(
    orderId: string,
    status: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<void> {
    await conn.query(`UPDATE orders SET status = ? WHERE id = ?`, [status, orderId]);
  }

  async setDeliveryOtp(
    orderId: string,
    otp: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<void> {
    await conn.query(
      `UPDATE orders
       SET delivery_otp = ?, delivery_otp_attempts = 0
       WHERE id = ? AND delivery_otp IS NULL`,
      [otp, orderId],
    );
  }

  async ensureDeliveryOtp(
    orderId: string,
    otp: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<string> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT delivery_otp FROM orders WHERE id = ? FOR UPDATE`,
      [orderId],
    );
    const existing = (rows[0]?.delivery_otp as string | null | undefined) ?? null;
    if (existing) return existing;
    await conn.query(
      `UPDATE orders SET delivery_otp = ?, delivery_otp_attempts = 0 WHERE id = ?`,
      [otp, orderId],
    );
    return otp;
  }

  async getDeliveryOtpState(
    orderId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<{ delivery_otp: string | null; delivery_otp_attempts: number } | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT delivery_otp, delivery_otp_attempts FROM orders WHERE id = ? FOR UPDATE`,
      [orderId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      delivery_otp: (row.delivery_otp as string | null) ?? null,
      delivery_otp_attempts: Number(row.delivery_otp_attempts ?? 0),
    };
  }

  async incrementDeliveryOtpAttempts(
    orderId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<number> {
    await conn.query(
      `UPDATE orders SET delivery_otp_attempts = delivery_otp_attempts + 1 WHERE id = ?`,
      [orderId],
    );
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT delivery_otp_attempts FROM orders WHERE id = ?`,
      [orderId],
    );
    return Number(rows[0]?.delivery_otp_attempts ?? 0);
  }

  async clearDeliveryOtp(
    orderId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<void> {
    await conn.query(
      `UPDATE orders SET delivery_otp = NULL, delivery_otp_attempts = 0 WHERE id = ?`,
      [orderId],
    );
  }

  async decrementInventory(
    storeId: string,
    variantId: string,
    quantity: number,
    conn: PoolConnection,
  ): Promise<boolean> {
    const [result] = await conn.query<ResultSetHeader>(
      `UPDATE inventory
       SET quantity_available = quantity_available - ?
       WHERE store_id = ? AND variant_id = ? AND quantity_available >= ?`,
      [quantity, storeId, variantId, quantity],
    );
    return result.affectedRows > 0;
  }

  async restoreInventory(
    storeId: string,
    variantId: string,
    quantity: number,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.query(
      `UPDATE inventory
       SET quantity_available = quantity_available + ?
       WHERE store_id = ? AND variant_id = ?`,
      [quantity, storeId, variantId],
    );
  }

  async lockPaymentByOrderId(
    orderId: string,
    conn: PoolConnection,
  ): Promise<{
    id: string;
    order_id: string;
    method: string;
    status: string;
    amount_paise: number;
    provider: string | null;
    provider_ref: string | null;
    razorpay_order_id?: string | null;
    razorpay_payment_id?: string | null;
  } | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, order_id, method, status, amount_paise, provider, provider_ref,
              razorpay_order_id, razorpay_payment_id
       FROM payments
       WHERE order_id = ?
       LIMIT 1
       FOR UPDATE`,
      [orderId],
    );
    return (rows[0] as {
      id: string;
      order_id: string;
      method: string;
      status: string;
      amount_paise: number;
      provider: string | null;
      provider_ref: string | null;
    }) ?? null;
  }

  async findCheckoutIdempotency(
    userId: string,
    idempotencyKey: string,
  ): Promise<{ order_id: string } | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT order_id
       FROM checkout_idempotency
       WHERE user_id = ? AND idempotency_key = ?
       LIMIT 1`,
      [userId, idempotencyKey],
    );
    return (rows[0] as { order_id: string }) ?? null;
  }

  async saveCheckoutIdempotency(
    input: { userId: string; idempotencyKey: string; orderId: string },
    conn: PoolConnection,
  ): Promise<void> {
    await conn.query(
      `INSERT INTO checkout_idempotency (id, user_id, idempotency_key, order_id)
       VALUES (?, ?, ?, ?)`,
      [createId(), input.userId, input.idempotencyKey, input.orderId],
    );
  }

  async cancelPendingOnlineOrder(
    orderId: string,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.query(
      `UPDATE orders
       SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'PENDING'`,
      [orderId],
    );
  }

  async markCartCheckedOut(cartId: string, conn: PoolConnection): Promise<void> {
    await conn.query(`DELETE FROM cart_items WHERE cart_id = ?`, [cartId]);
    await conn.query(
      `UPDATE carts SET status = 'CHECKED_OUT', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'ACTIVE'`,
      [cartId],
    );
  }

  async countByUser(userId: string): Promise<number> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM orders WHERE user_id = ?`,
      [userId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async listByUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<OrderRow[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
          o.id, o.order_number, o.user_id, o.store_id, o.service_area_id, o.delivery_zone_id,
          o.address_id, o.status, o.item_total_paise, o.delivery_fee_paise, o.tax_paise,
          o.discount_paise, o.grand_total_paise, o.currency, o.notes,
          o.delivery_otp, o.delivery_otp_attempts, o.placed_at,
          o.delivered_at, o.cancelled_at,
          s.name AS store_name,
          a.label AS address_label,
          a.line1 AS address_line1,
          a.city AS address_city,
          p.method AS payment_method,
          p.status AS payment_status
       FROM orders o
       INNER JOIN stores s ON s.id = o.store_id
       INNER JOIN addresses a ON a.id = o.address_id
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.user_id = ?
       ORDER BY o.placed_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset],
    );
    return rows as OrderRow[];
  }

  async findByIdOrNumberForUser(
    userId: string,
    idOrNumber: string,
  ): Promise<OrderRow | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
          o.id, o.order_number, o.user_id, o.store_id, o.service_area_id, o.delivery_zone_id,
          o.address_id, o.status, o.item_total_paise, o.delivery_fee_paise, o.tax_paise,
          o.discount_paise, o.grand_total_paise, o.currency, o.notes,
          o.delivery_otp, o.delivery_otp_attempts, o.placed_at,
          o.delivered_at, o.cancelled_at,
          s.name AS store_name,
          a.label AS address_label,
          a.line1 AS address_line1,
          a.city AS address_city,
          p.method AS payment_method,
          p.status AS payment_status
       FROM orders o
       INNER JOIN stores s ON s.id = o.store_id
       INNER JOIN addresses a ON a.id = o.address_id
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.user_id = ?
         AND (o.id = ? OR o.order_number = ?)
       LIMIT 1`,
      [userId, idOrNumber, idOrNumber],
    );
    return (rows[0] as OrderRow) ?? null;
  }

  async listItems(
    orderId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<OrderItemRow[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT
          oi.id, oi.order_id, oi.product_id, oi.variant_id, oi.product_name, oi.variant_label,
          oi.unit_price_paise, oi.quantity, oi.line_total_paise,
          p.image_url AS product_image_url
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.created_at ASC`,
      [orderId],
    );
    return rows as OrderItemRow[];
  }

  async listExpiredUnpaidOnlineOrders(
    olderThanMinutes: number,
    limit: number,
    conn: PoolConnection,
  ): Promise<
    Array<{
      id: string;
      user_id: string;
      store_id: string;
      order_number: string;
    }>
  > {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT o.id, o.user_id, o.store_id, o.order_number
       FROM orders o
       INNER JOIN payments p ON p.order_id = o.id
       WHERE o.status = 'PENDING'
         AND p.status = 'PENDING'
         AND p.provider = 'razorpay'
         AND o.placed_at < (UTC_TIMESTAMP() - INTERVAL ? MINUTE)
       ORDER BY o.placed_at ASC
       LIMIT ?
       FOR UPDATE SKIP LOCKED`,
      [olderThanMinutes, limit],
    );
    return rows as Array<{
      id: string;
      user_id: string;
      store_id: string;
      order_number: string;
    }>;
  }

  async lockOrderById(
    orderId: string,
    conn: PoolConnection,
  ): Promise<{ id: string; status: string; store_id: string; user_id: string; order_number: string } | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, status, store_id, user_id, order_number
       FROM orders
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [orderId],
    );
    return (rows[0] as {
      id: string;
      status: string;
      store_id: string;
      user_id: string;
      order_number: string;
    }) ?? null;
  }

  async listStatusHistory(orderId: string): Promise<StatusHistoryRow[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, order_id, from_status, to_status, note, created_at
       FROM order_status_history
       WHERE order_id = ?
       ORDER BY created_at ASC`,
      [orderId],
    );
    return rows as StatusHistoryRow[];
  }

  async nextOrderSequence(conn: PoolConnection): Promise<number> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM orders WHERE DATE(placed_at) = CURDATE()`,
    );
    return Number(rows[0]?.total ?? 0) + 1;
  }
}
