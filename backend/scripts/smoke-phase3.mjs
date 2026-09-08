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
  console.log(method, path, res.status, JSON.stringify(data).slice(0, 400));
  if (!data.success && res.status >= 500) process.exitCode = 1;
  return data;
}

const phone = '9876501234';
await json('POST', '/auth/otp/request', { body: { phone } });
const verify = await json('POST', '/auth/otp/verify', { body: { phone, otp: '1234' } });
const token = verify?.data?.accessToken;
if (!token) {
  console.error('No access token');
  process.exit(1);
}

await json('POST', '/addresses', {
  token,
  body: {
    line1: '12 Market Road',
    city: 'Launch Town',
    pincode: '226001',
    isDefault: true,
  },
});
await json('GET', '/addresses', { token });

const product = await json('GET', '/products/fresh-milk');
const variantId = product?.data?.variants?.[0]?.id;
const cart = await json('POST', '/cart/items', { token, body: { variantId, quantity: 1 } });
if (!cart.success) process.exit(1);
await json('GET', '/cart', { token });
console.log('SMOKE_OK');
