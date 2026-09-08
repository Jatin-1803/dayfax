const base = 'http://127.0.0.1:3000/api/v1';

async function json(method, path, { token, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  console.log(method, path, res.status, JSON.stringify(data).slice(0, 350));
  return data;
}

const phone = '9876509999';
await json('POST', '/auth/otp/request', { body: { phone } });
const verify = await json('POST', '/auth/otp/verify', { body: { phone, otp: '1234' } });
const token = verify?.data?.accessToken;
if (!token) process.exit(1);

const address = await json('POST', '/addresses', {
  token,
  body: { line1: '99 Checkout Lane', city: 'Launch Town', pincode: '226001', isDefault: true },
});
const product = await json('GET', '/products/fresh-milk');
const variantId = product?.data?.variants?.[0]?.id;
await json('POST', '/cart/items', { token, body: { variantId, quantity: 1 } });
const order = await json('POST', '/orders/checkout', {
  token,
  body: { addressId: address.data.id, paymentMethod: 'COD' },
});
if (!order.success) process.exit(1);
await json('GET', `/orders/${order.data.id}`, { token });
await json('GET', `/orders/${order.data.id}/timeline`, { token });
await json('GET', '/orders?page=1', { token });
console.log('PHASE4_SMOKE_OK');
