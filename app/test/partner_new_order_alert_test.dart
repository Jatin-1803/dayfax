import 'package:dailyfax/features/delivery/domain/partner_new_order_alert.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  tearDown(() {
    partnerNewOrderAlert.value = null;
    partnerOrderTakenSignal.value = null;
  });

  test('parses push payload without requiring customer PII', () {
    final alert = PartnerNewOrderAlert.fromPushData({
      'orderId': 'ord-1',
      'orderNumber': 'ORD-10245',
      'storeName': 'ABC Store',
      'area': 'Sector 45',
      'paymentMethod': 'COD',
      'amountPaise': '85000',
    });

    expect(alert.orderId, 'ord-1');
    expect(alert.orderNumber, 'ORD-10245');
    expect(alert.storeName, 'ABC Store');
    expect(alert.isCod, isTrue);
    expect(alert.amountPaise, 85000);
  });

  test('order taken signal dismisses matching alert', () {
    presentPartnerNewOrderAlert(
      const PartnerNewOrderAlert(orderId: 'ord-1', orderNumber: 'ORD-1'),
    );
    expect(partnerNewOrderAlert.value?.orderId, 'ord-1');

    signalPartnerOrderTaken('ord-1');
    expect(partnerNewOrderAlert.value, isNull);
    expect(partnerOrderTakenSignal.value, 'ord-1');
  });

  test('dismiss ignores unrelated order ids', () {
    presentPartnerNewOrderAlert(
      const PartnerNewOrderAlert(orderId: 'ord-1', orderNumber: 'ORD-1'),
    );
    dismissPartnerNewOrderAlert(orderId: 'ord-other');
    expect(partnerNewOrderAlert.value?.orderId, 'ord-1');
  });
}
