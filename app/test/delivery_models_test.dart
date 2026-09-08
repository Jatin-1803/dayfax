import 'package:dailyfax/features/delivery/domain/delivery_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('DeliveryJob parses string address coordinates from API', () {
    final job = DeliveryJob.fromJson({
      'orderId': 'order-1',
      'orderNumber': 'DF-1',
      'orderStatus': 'CONFIRMED',
      'grandTotalPaise': 1000,
      'currency': 'INR',
      'placedAt': '2026-09-06T21:57:10Z',
      'store': {'id': 'store-1', 'name': 'Mart'},
      'address': {
        'id': 'addr-1',
        'label': 'Home',
        'line1': 'Lane 1',
        'city': 'Gurugram',
        'latitude': '28.4886803',
        'longitude': '77.0963211',
      },
      'customer': {'phoneCountryCode': '+91', 'phone': '9999999999'},
      'assignment': null,
    });

    expect(job.address.latitude, closeTo(28.4886803, 0.0000001));
    expect(job.address.longitude, closeTo(77.0963211, 0.0000001));
    expect(job.needsCodCollection, isFalse);
    expect(job.otpAllowed, isFalse);
  });

  test('DeliveryJob exposes COD collect amount and locks OTP until paid', () {
    final unpaid = DeliveryJob.fromJson({
      'orderId': 'order-1',
      'orderNumber': 'DF-1',
      'orderStatus': 'CONFIRMED',
      'grandTotalPaise': 49900,
      'currency': 'INR',
      'placedAt': '2026-09-06T21:57:10Z',
      'store': {'id': 'store-1', 'name': 'Mart'},
      'address': {'id': 'addr-1', 'label': 'Home', 'line1': 'Lane 1', 'city': 'Gurugram'},
      'assignment': {
        'id': 'asg-1',
        'status': 'IN_PROGRESS',
        'assignedAt': '2026-09-06T22:00:00Z',
      },
      'payment': {
        'method': 'COD',
        'status': 'PENDING',
        'amountPaise': 49900,
        'collectAmountPaise': 49900,
      },
      'otpAllowed': false,
    });

    expect(unpaid.needsCodCollection, isTrue);
    expect(unpaid.canComplete, isFalse);
    expect(unpaid.otpAllowed, isFalse);

    final paid = DeliveryJob.fromJson({
      'orderId': 'order-1',
      'orderNumber': 'DF-1',
      'orderStatus': 'OUT_FOR_DELIVERY',
      'grandTotalPaise': 49900,
      'currency': 'INR',
      'placedAt': '2026-09-06T21:57:10Z',
      'store': {'id': 'store-1', 'name': 'Mart'},
      'address': {'id': 'addr-1', 'label': 'Home', 'line1': 'Lane 1', 'city': 'Gurugram'},
      'assignment': {
        'id': 'asg-1',
        'status': 'IN_PROGRESS',
        'assignedAt': '2026-09-06T22:00:00Z',
      },
      'payment': {
        'method': 'COD',
        'status': 'CAPTURED',
        'amountPaise': 49900,
        'collectAmountPaise': 0,
      },
      'otpAllowed': true,
    });

    expect(paid.needsCodCollection, isFalse);
    expect(paid.canComplete, isTrue);
    expect(paid.isPaidOnline, isFalse);
  });
}
