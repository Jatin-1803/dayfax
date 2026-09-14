import 'package:dailyfax/features/delivery/domain/delivery_models.dart';
import 'package:dailyfax/features/orders/domain/order_models.dart';
import 'package:dailyfax/features/support/domain/support_models.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _orderJson({
  String status = 'DELIVERED',
  Map<String, dynamic>? returnRequest,
  String paymentMethod = 'UPI',
}) {
  return {
    'id': 'order-1',
    'orderNumber': 'DF20260908-000001',
    'status': status,
    'itemTotalPaise': 5000,
    'deliveryFeePaise': 2500,
    'grandTotalPaise': 7500,
    'placedAt': '2026-09-08T10:00:00.000Z',
    'store': {'id': 's1', 'name': 'DayFax Mart'},
    'address': {'id': 'a1', 'label': 'Home', 'line1': 'Lane 1', 'city': 'Gurugram'},
    'payment': {'method': paymentMethod, 'status': 'CAPTURED'},
    if (returnRequest != null) 'returnRequest': returnRequest,
  };
}

void main() {
  test('support chat parses which order the return is for', () {
    final thread = SupportThread.fromJson({
      'order': {
        'orderNumber': 'DF20260908-000001',
        'storeName': 'DayFax Mart',
        'placedAt': '2026-09-08T10:00:00.000Z',
      },
      'conversation': {'agentName': 'Ananya'},
      'messages': [],
      'orderItems': [
        {'id': 'item-1', 'productName': 'Milk', 'quantity': 2, 'variantLabel': ''},
      ],
      'showItemPicker': true,
    });

    expect(thread.orderNumber, 'DF20260908-000001');
    expect(thread.storeName, 'DayFax Mart');
    expect(thread.placedAt, isNotNull);
    expect(thread.showDamageForm, isTrue);
    expect(thread.hasOpenReturn, isFalse);
  });

  test('support chat keeps the submitted return tied to the order', () {
    final thread = SupportThread.fromJson({
      'order': {'orderNumber': 'DF20260908-000001', 'storeName': 'DayFax Mart'},
      'returnRequest': {'status': 'PENDING_REVIEW'},
      'messages': [],
    });

    expect(thread.hasOpenReturn, isTrue);
    expect(thread.orderNumber, 'DF20260908-000001');
  });

  test('order detail keeps Delivered and names the returned items', () {
    final order = CustomerOrder.fromJson(
      _orderJson(
        returnRequest: {
          'id': 'ret-1',
          'status': 'APPROVED',
          'refundAmountPaise': 5000,
          'refundMethod': 'RAZORPAY',
          'refundStatus': 'NONE',
          'pickupCode': '4821',
          'items': [
            {
              'orderItemId': 'item-1',
              'productName': 'Milk',
              'variantLabel': '1 L',
              'quantity': 1,
            },
          ],
        },
      ),
    );

    expect(order.status, 'DELIVERED');
    expect(order.keepsDeliveredWithReturn, isTrue);
    expect(order.returnStatusChipKey, 'returns.chip_approved');
    expect(order.returnRequest!.pickupCode, '4821');
    expect(order.returnRequest!.items.single.productName, 'Milk');
    expect(order.paymentMethodKey, 'orders.payment_online');
    expect(order.statusMessageKey, 'returns.status_approved');
  });

  test('payment stays payment when a return exists', () {
    final order = CustomerOrder.fromJson(_orderJson(paymentMethod: 'COD'));

    expect(order.paymentMethodKey, 'orders.payment_cod');
    expect(order.keepsDeliveredWithReturn, isFalse);
  });

  test('partner pickup names the order, customer, and items at each stage', () {
    final job = DeliveryJob.fromJson({
      'orderId': 'order-1',
      'orderNumber': 'DF20260908-000001',
      'orderStatus': 'DELIVERED',
      'grandTotalPaise': 7500,
      'placedAt': '2026-09-08T10:00:00.000Z',
      'purpose': 'RETURN_PICKUP',
      'returnRequestId': 'ret-1',
      'returnNote': 'Bottle leaked',
      'store': {'id': 's1', 'name': 'DayFax Mart'},
      'address': {
        'id': 'a1',
        'label': 'Home',
        'fullName': 'Ravi Kumar',
        'line1': 'Lane 1',
        'city': 'Gurugram',
      },
      'returnItems': [
        {'productName': 'Milk', 'variantLabel': '1 L', 'quantity': 1},
      ],
      'payment': {'method': 'UPI', 'status': 'CAPTURED', 'amountPaise': 7500},
    });

    expect(job.isReturnPickup, isTrue);
    expect(job.needsCodCollection, isFalse);
    expect(job.listTitleKey, 'delivery.return_for_order');
    expect(job.addressLabelKey, 'delivery.pickup_from_customer');
    expect(job.confirmTitleKey, 'delivery.collect_items_title');
    expect(job.confirmCodeLabelKey, 'delivery.pickup_code_label');
    expect(job.successTitleKey, 'delivery.pickup_collected_title');
    expect(job.successMessageKey, 'delivery.pickup_collected_message');
    expect(job.customerName, 'Ravi Kumar');
    expect(job.collectItems.single.displayLine, 'Milk · 1 L × 1');
    expect(job.returnNote, 'Bottle leaked');
  });

  test('a normal delivery does not use pickup copy', () {
    final job = DeliveryJob.fromJson({
      'orderId': 'order-1',
      'orderNumber': 'DF-1',
      'orderStatus': 'OUT_FOR_DELIVERY',
      'grandTotalPaise': 1000,
      'placedAt': '2026-09-08T10:00:00.000Z',
      'store': {'id': 's1', 'name': 'Mart'},
      'address': {'id': 'a1', 'label': 'Home', 'line1': 'Lane 1', 'city': 'Gurugram'},
    });

    expect(job.isReturnPickup, isFalse);
    expect(job.listTitleKey, 'delivery.order_details');
    expect(job.addressLabelKey, 'delivery.delivery_address');
    expect(job.confirmCodeLabelKey, 'delivery.otp_label');
    expect(job.successTitleKey, 'delivery.delivered_title');
    expect(job.collectItems, isEmpty);
  });
}
