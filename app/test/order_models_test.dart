import 'package:dailyfax/features/orders/domain/order_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('CustomerOrder parses checkout payload with timeline', () {
    final order = CustomerOrder.fromJson({
      'id': 'o1',
      'orderNumber': 'DF20260906-ABC123',
      'status': 'CONFIRMED',
      'itemTotalPaise': 3000,
      'deliveryFeePaise': 2500,
      'taxPaise': 0,
      'discountPaise': 0,
      'grandTotalPaise': 5500,
      'currency': 'INR',
      'placedAt': '2026-09-06T10:00:00.000Z',
      'store': {'id': 's1', 'name': 'DayFax Mart'},
      'address': {
        'id': 'a1',
        'label': 'Home',
        'line1': '12 Market Road',
        'city': 'Launch Town',
      },
      'payment': {'method': 'COD', 'status': 'PENDING'},
      'items': [
        {
          'id': 'i1',
          'productName': 'Fresh Milk',
          'variantLabel': '500 ml',
          'unitPricePaise': 3000,
          'quantity': 1,
          'lineTotalPaise': 3000,
        },
      ],
      'timeline': {
        'currentStatus': 'CONFIRMED',
        'steps': [
          {'status': 'PENDING', 'reached': true, 'current': false},
          {'status': 'CONFIRMED', 'reached': true, 'current': true},
        ],
        'history': [
          {
            'id': 'h1',
            'fromStatus': null,
            'toStatus': 'PENDING',
            'note': 'Order placed',
            'at': '2026-09-06T10:00:00.000Z',
          },
        ],
      },
    });

    expect(order.orderNumber, 'DF20260906-ABC123');
    expect(order.grandTotalPaise, 5500);
    expect(order.timeline?.steps.last.current, isTrue);
    expect(order.items.first.productName, 'Fresh Milk');
  });

  test('CustomerOrder parses delivery OTP for active orders', () {
    final order = CustomerOrder.fromJson({
      'id': 'o2',
      'orderNumber': 'DF20260907-OTP001',
      'status': 'OUT_FOR_DELIVERY',
      'itemTotalPaise': 1000,
      'deliveryFeePaise': 2500,
      'grandTotalPaise': 3500,
      'deliveryOtp': '4821',
      'placedAt': '2026-09-07T10:00:00.000Z',
      'store': {'id': 's1', 'name': 'DayFax Mart'},
      'address': {
        'id': 'a1',
        'label': 'Home',
        'line1': '12 Market Road',
        'city': 'Launch Town',
      },
    });

    expect(order.hasDeliveryOtp, isTrue);
    expect(order.deliveryOtp, '4821');
  });

  test('CustomerOrder hides COD OTP until payment is captured', () {
    final unpaid = CustomerOrder.fromJson({
      'id': 'o3',
      'orderNumber': 'DF-COD',
      'status': 'CONFIRMED',
      'itemTotalPaise': 49900,
      'deliveryFeePaise': 0,
      'grandTotalPaise': 49900,
      'deliveryOtp': '1234',
      'placedAt': '2026-09-07T10:00:00.000Z',
      'store': {'id': 's1', 'name': 'DayFax Mart'},
      'address': {'id': 'a1', 'label': 'Home', 'line1': 'Lane', 'city': 'Town'},
      'payment': {'method': 'COD', 'status': 'PENDING'},
    });

    expect(unpaid.showDeliveryOtp, isFalse);
    expect(unpaid.statusMessageKey, 'orders.status_partner_assigned_cod');

    final placed = CustomerOrder.fromJson({
      'id': 'o4',
      'orderNumber': 'DF-NEW',
      'status': 'PENDING',
      'itemTotalPaise': 49900,
      'deliveryFeePaise': 0,
      'grandTotalPaise': 49900,
      'placedAt': '2026-09-07T10:00:00.000Z',
      'store': {'id': 's1', 'name': 'DayFax Mart'},
      'address': {'id': 'a1', 'label': 'Home', 'line1': 'Lane', 'city': 'Town'},
      'payment': {'method': 'COD', 'status': 'PENDING'},
    });

    expect(placed.statusMessageKey, 'orders.status_placed');
    expect(placed.partnerMessageKey, 'orders.partner_soon');
  });
}
