import { describe, expect, it } from 'vitest';
import { pushCopy } from './push-copy.js';

describe('pushCopy partner_new_order', () => {
  it('uses high-priority default title and body', () => {
    const copy = pushCopy('partner_new_order', 'en', 'ORD-10245');
    expect(copy.title).toContain('New Order Available');
    expect(copy.body).toContain('ORD-10245');
    expect(copy.body.toLowerCase()).toContain('tap');
  });

  it('includes non-sensitive extras when provided', () => {
    const copy = pushCopy('partner_new_order', 'en', 'ORD-10245', {
      storeName: 'ABC Store',
      area: 'Sector 45',
      paymentLabel: 'COD',
      amountLabel: '₹850',
    });
    expect(copy.body).toContain('ABC Store');
    expect(copy.body).toContain('Sector 45');
    expect(copy.body).toContain('COD');
    expect(copy.body).not.toMatch(/\+91|phone/i);
  });

  it('has partner_order_taken copy', () => {
    const copy = pushCopy('partner_order_taken', 'en', 'ORD-9');
    expect(copy.title.toLowerCase()).toContain('taken');
    expect(copy.body).toContain('ORD-9');
  });
});
