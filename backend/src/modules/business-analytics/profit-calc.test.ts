import { describe, expect, it } from 'vitest';
import { lineProfit, marginPercent, orderProfit, roundMargin } from './profit-calc.js';

describe('profit-calc', () => {
  it('computes line profit from snapshotted CP', () => {
    const result = lineProfit({
      quantity: 2,
      unitPricePaise: 50000,
      lineTotalPaise: 100000,
      unitCostPaise: 30000,
    });
    expect(result.revenuePaise).toBe(100000);
    expect(result.costPaise).toBe(60000);
    expect(result.profitPaise).toBe(40000);
    expect(result.costDataAvailable).toBe(true);
  });

  it('marks profit unavailable when CP is null', () => {
    const result = lineProfit({
      quantity: 1,
      unitPricePaise: 10000,
      lineTotalPaise: 10000,
      unitCostPaise: null,
    });
    expect(result.costDataAvailable).toBe(false);
    expect(result.profitPaise).toBeNull();
  });

  it('allows zero CP', () => {
    const result = lineProfit({
      quantity: 1,
      unitPricePaise: 10000,
      lineTotalPaise: 10000,
      unitCostPaise: 0,
    });
    expect(result.costPaise).toBe(0);
    expect(result.profitPaise).toBe(10000);
  });

  it('shows negative profit (loss)', () => {
    const result = lineProfit({
      quantity: 1,
      unitPricePaise: 50000,
      lineTotalPaise: 50000,
      unitCostPaise: 65000,
    });
    expect(result.profitPaise).toBe(-15000);
  });

  it('excludes cancelled orders from sales profit', () => {
    const result = orderProfit({
      itemTotalPaise: 100000,
      deliveryFeePaise: 3000,
      taxPaise: 0,
      discountPaise: 0,
      status: 'CANCELLED',
      refundedItemPaise: 0,
      lines: [
        {
          quantity: 1,
          unitPricePaise: 100000,
          lineTotalPaise: 100000,
          unitCostPaise: 40000,
        },
      ],
    });
    expect(result.includedInSales).toBe(false);
    expect(result.grossProfitPaise).toBeNull();
    expect(result.netProfitPaise).toBeNull();
  });

  it('subtracts refunded revenue but keeps COGS for damaged returns', () => {
    const result = orderProfit({
      itemTotalPaise: 100000,
      deliveryFeePaise: 4000,
      taxPaise: 0,
      discountPaise: 0,
      status: 'DELIVERED',
      refundedItemPaise: 100000,
      lines: [
        {
          quantity: 2,
          unitPricePaise: 50000,
          lineTotalPaise: 100000,
          unitCostPaise: 30000,
        },
      ],
    });
    // Revenue reversed fully; COGS 60000 remains → gross -60000; net adds delivery
    expect(result.netItemRevenuePaise).toBe(0);
    expect(result.costPaise).toBe(60000);
    expect(result.grossProfitPaise).toBe(-60000);
    expect(result.netProfitPaise).toBe(-56000);
  });

  it('includes delivery in net but not gross', () => {
    const result = orderProfit({
      itemTotalPaise: 100000,
      deliveryFeePaise: 5000,
      taxPaise: 0,
      discountPaise: 0,
      status: 'DELIVERED',
      refundedItemPaise: 0,
      lines: [
        {
          quantity: 1,
          unitPricePaise: 100000,
          lineTotalPaise: 100000,
          unitCostPaise: 40000,
        },
      ],
    });
    expect(result.grossProfitPaise).toBe(60000);
    expect(result.netProfitPaise).toBe(65000);
    expect(roundMargin(result.grossMarginPercent)).toBe(60);
  });

  it('handles multi-line quantity correctly', () => {
    const result = orderProfit({
      itemTotalPaise: 150000,
      deliveryFeePaise: 0,
      taxPaise: 0,
      discountPaise: 0,
      status: 'DELIVERED',
      refundedItemPaise: 0,
      lines: [
        {
          quantity: 2,
          unitPricePaise: 50000,
          lineTotalPaise: 100000,
          unitCostPaise: 20000,
        },
        {
          quantity: 1,
          unitPricePaise: 50000,
          lineTotalPaise: 50000,
          unitCostPaise: 10000,
        },
      ],
    });
    expect(result.costPaise).toBe(50000);
    expect(result.grossProfitPaise).toBe(100000);
  });

  it('computes margin from precise values', () => {
    expect(marginPercent(53540000, 124580000)).toBeCloseTo(42.9764, 3);
    expect(roundMargin(marginPercent(53540000, 124580000))).toBe(42.98);
  });
});
