import { getPool } from '../common/database/pool.js';
import { notifyPartnersNewOrder } from '../modules/notifications/partner-new-order.service.js';

async function main() {
  const pool = getPool();

  const [devices] = await pool.query(`
    SELECT d.user_id, u.full_name, u.phone, d.fcm_token, d.platform, d.updated_at
    FROM user_devices d
    INNER JOIN users u ON u.id = d.user_id
    WHERE d.app_role = 'DELIVERY_PARTNER'
    ORDER BY d.updated_at DESC
  `);
  console.log('Partner devices:', JSON.stringify(devices, null, 2));

  const [orders] = await pool.query(`
    SELECT o.id, o.order_number, o.status, p.method, p.status AS payment_status, o.placed_at
    FROM orders o
    LEFT JOIN payments p ON p.order_id = o.id
    LEFT JOIN order_acceptance_locks l ON l.order_id = o.id
    LEFT JOIN delivery_assignments da ON da.order_id = o.id
      AND da.status IN ('ASSIGNED','ACCEPTED','IN_PROGRESS')
    WHERE o.status IN ('PENDING','CONFIRMED','PREPARING','READY_FOR_PICKUP')
      AND l.order_id IS NULL
      AND da.id IS NULL
      AND (
        (o.status = 'PENDING' AND p.method = 'COD' AND p.status = 'PENDING')
        OR (o.status = 'PENDING' AND p.method IN ('UPI','CARD','WALLET') AND p.status = 'CAPTURED')
        OR o.status IN ('CONFIRMED','PREPARING','READY_FOR_PICKUP')
      )
    ORDER BY o.placed_at DESC
    LIMIT 5
  `);
  console.log('Claimable orders:', JSON.stringify(orders, null, 2));

  const orderId = (orders as Array<{ id: string }>)[0]?.id;
  if (!orderId) {
    console.error('No claimable order found. Place a COD order first.');
    await pool.end();
    process.exit(1);
  }

  const [existing] = await pool.query(
    `SELECT id, delivery_boy_id, status, attempt_count, sent_at
     FROM order_delivery_notifications
     WHERE order_id = ? AND notification_type = 'partner_new_order'`,
    [orderId],
  );
  console.log('Existing notification rows for order:', JSON.stringify(existing, null, 2));

  console.log(`\nTriggering REAL partner_new_order push for order ${orderId}...`);
  await notifyPartnersNewOrder(orderId);

  const [after] = await pool.query(
    `SELECT id, delivery_boy_id, status, attempt_count, failure_reason, sent_at
     FROM order_delivery_notifications
     WHERE order_id = ? AND notification_type = 'partner_new_order'`,
    [orderId],
  );
  console.log('After send:', JSON.stringify(after, null, 2));

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
