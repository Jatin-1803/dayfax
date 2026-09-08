import 'package:equatable/equatable.dart';

class OrderPayment extends Equatable {
  const OrderPayment({required this.method, required this.status});

  final String method;
  final String status;

  factory OrderPayment.fromJson(Map<String, dynamic> json) {
    return OrderPayment(
      method: json['method'] as String? ?? 'COD',
      status: json['status'] as String? ?? 'PENDING',
    );
  }

  @override
  List<Object?> get props => [method, status];
}

class RazorpayCheckout extends Equatable {
  const RazorpayCheckout({
    required this.keyId,
    required this.orderId,
    required this.amountPaise,
    required this.currency,
    required this.name,
    required this.description,
  });

  final String keyId;
  final String orderId;
  final int amountPaise;
  final String currency;
  final String name;
  final String description;

  factory RazorpayCheckout.fromJson(Map<String, dynamic> json) {
    return RazorpayCheckout(
      keyId: json['keyId'] as String,
      orderId: json['orderId'] as String,
      amountPaise: (json['amountPaise'] as num).toInt(),
      currency: json['currency'] as String? ?? 'INR',
      name: json['name'] as String? ?? 'DayFax',
      description: json['description'] as String? ?? 'Order payment',
    );
  }

  @override
  List<Object?> get props => [keyId, orderId, amountPaise];
}

class CheckoutResult extends Equatable {
  const CheckoutResult({required this.order, this.razorpay});

  final CustomerOrder order;
  final RazorpayCheckout? razorpay;

  factory CheckoutResult.fromJson(Map<String, dynamic> json) {
    final razorpayJson = json['razorpay'] as Map<String, dynamic>?;
    return CheckoutResult(
      order: CustomerOrder.fromJson(json),
      razorpay: razorpayJson == null ? null : RazorpayCheckout.fromJson(razorpayJson),
    );
  }

  @override
  List<Object?> get props => [order, razorpay];
}

class OrderAddressSummary extends Equatable {
  const OrderAddressSummary({
    required this.id,
    required this.label,
    required this.line1,
    required this.city,
  });

  final String id;
  final String label;
  final String line1;
  final String city;

  factory OrderAddressSummary.fromJson(Map<String, dynamic> json) {
    return OrderAddressSummary(
      id: json['id'] as String,
      label: json['label'] as String? ?? '',
      line1: json['line1'] as String? ?? '',
      city: json['city'] as String? ?? '',
    );
  }

  String get summary => [line1, city].where((e) => e.isNotEmpty).join(', ');

  @override
  List<Object?> get props => [id];
}

class OrderItem extends Equatable {
  const OrderItem({
    required this.id,
    required this.productName,
    required this.variantLabel,
    required this.unitPricePaise,
    required this.quantity,
    required this.lineTotalPaise,
    this.imageUrl,
  });

  final String id;
  final String productName;
  final String variantLabel;
  final int unitPricePaise;
  final int quantity;
  final int lineTotalPaise;
  final String? imageUrl;

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    return OrderItem(
      id: json['id'] as String,
      productName: json['productName'] as String,
      variantLabel: json['variantLabel'] as String? ?? '',
      unitPricePaise: (json['unitPricePaise'] as num).toInt(),
      quantity: (json['quantity'] as num).toInt(),
      lineTotalPaise: (json['lineTotalPaise'] as num).toInt(),
      imageUrl: json['imageUrl'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, quantity];
}

class OrderTimelineStep extends Equatable {
  const OrderTimelineStep({
    required this.status,
    required this.reached,
    required this.current,
  });

  final String status;
  final bool reached;
  final bool current;

  factory OrderTimelineStep.fromJson(Map<String, dynamic> json) {
    return OrderTimelineStep(
      status: json['status'] as String,
      reached: json['reached'] as bool? ?? false,
      current: json['current'] as bool? ?? false,
    );
  }

  @override
  List<Object?> get props => [status, reached, current];
}

class OrderTimelineEvent extends Equatable {
  const OrderTimelineEvent({
    required this.id,
    required this.toStatus,
    required this.at,
    this.fromStatus,
    this.note,
  });

  final String id;
  final String? fromStatus;
  final String toStatus;
  final String? note;
  final DateTime at;

  factory OrderTimelineEvent.fromJson(Map<String, dynamic> json) {
    return OrderTimelineEvent(
      id: json['id'] as String,
      fromStatus: json['fromStatus'] as String?,
      toStatus: json['toStatus'] as String,
      note: json['note'] as String?,
      at: DateTime.parse(json['at'] as String),
    );
  }

  @override
  List<Object?> get props => [id, toStatus];
}

class OrderTimeline extends Equatable {
  const OrderTimeline({
    required this.currentStatus,
    required this.steps,
    required this.history,
  });

  final String currentStatus;
  final List<OrderTimelineStep> steps;
  final List<OrderTimelineEvent> history;

  factory OrderTimeline.fromJson(Map<String, dynamic> json) {
    return OrderTimeline(
      currentStatus: json['currentStatus'] as String,
      steps: (json['steps'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(OrderTimelineStep.fromJson)
          .toList(),
      history: (json['history'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(OrderTimelineEvent.fromJson)
          .toList(),
    );
  }

  @override
  List<Object?> get props => [currentStatus, steps, history];
}

class CustomerOrder extends Equatable {
  const CustomerOrder({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.itemTotalPaise,
    required this.deliveryFeePaise,
    required this.grandTotalPaise,
    required this.placedAt,
    required this.storeName,
    required this.address,
    this.taxPaise = 0,
    this.discountPaise = 0,
    this.currency = 'INR',
    this.notes,
    this.deliveryOtp,
    this.payment,
    this.items = const [],
    this.timeline,
  });

  final String id;
  final String orderNumber;
  final String status;
  final int itemTotalPaise;
  final int deliveryFeePaise;
  final int taxPaise;
  final int discountPaise;
  final int grandTotalPaise;
  final String currency;
  final String? notes;
  final String? deliveryOtp;
  final DateTime placedAt;
  final String storeName;
  final OrderAddressSummary address;
  final OrderPayment? payment;
  final List<OrderItem> items;
  final OrderTimeline? timeline;

  factory CustomerOrder.fromJson(Map<String, dynamic> json) {
    final store = json['store'] as Map<String, dynamic>? ?? const {};
    final paymentJson = json['payment'] as Map<String, dynamic>?;
    final timelineJson = json['timeline'] as Map<String, dynamic>?;
    final itemsJson = json['items'] as List<dynamic>?;
    final otpRaw = json['deliveryOtp'] as String?;
    return CustomerOrder(
      id: json['id'] as String,
      orderNumber: json['orderNumber'] as String,
      status: json['status'] as String,
      itemTotalPaise: (json['itemTotalPaise'] as num).toInt(),
      deliveryFeePaise: (json['deliveryFeePaise'] as num).toInt(),
      taxPaise: (json['taxPaise'] as num?)?.toInt() ?? 0,
      discountPaise: (json['discountPaise'] as num?)?.toInt() ?? 0,
      grandTotalPaise: (json['grandTotalPaise'] as num).toInt(),
      currency: json['currency'] as String? ?? 'INR',
      notes: json['notes'] as String?,
      deliveryOtp: otpRaw != null && otpRaw.isNotEmpty ? otpRaw : null,
      placedAt: DateTime.parse(json['placedAt'] as String),
      storeName: store['name'] as String? ?? '',
      address: OrderAddressSummary.fromJson(
        json['address'] as Map<String, dynamic>? ?? const {},
      ),
      payment: paymentJson == null ? null : OrderPayment.fromJson(paymentJson),
      items: itemsJson == null
          ? const []
          : itemsJson.whereType<Map<String, dynamic>>().map(OrderItem.fromJson).toList(),
      timeline: timelineJson == null ? null : OrderTimeline.fromJson(timelineJson),
    );
  }

  String get statusLabel => status.replaceAll('_', ' ');

  bool get hasDeliveryOtp => deliveryOtp != null && deliveryOtp!.isNotEmpty;

  bool get isCod => payment?.method == 'COD';

  bool get isPaymentCaptured => payment?.status == 'CAPTURED';

  bool get showDeliveryOtp => hasDeliveryOtp && (!isCod || isPaymentCaptured);

  String get statusMessageKey {
    if (status == 'CANCELLED') return 'orders.status_cancelled';
    if (status == 'DELIVERED') return 'orders.delivered_success';
    if (status == 'PENDING') {
      if (!isCod && !isPaymentCaptured) return 'orders.status_payment_pending';
      if (isPaymentCaptured) return 'orders.status_waiting_partner';
      return 'orders.status_placed';
    }
    if (status == 'OUT_FOR_DELIVERY') {
      if (isCod && !isPaymentCaptured) return 'orders.status_pay_on_delivery';
      if (isCod && isPaymentCaptured && showDeliveryOtp) return 'orders.status_enter_otp';
      if (showDeliveryOtp) return 'orders.status_enter_otp';
      return 'orders.status_on_the_way';
    }
    if (status == 'CONFIRMED' ||
        status == 'PREPARING' ||
        status == 'READY_FOR_PICKUP' ||
        status == 'PICKED_UP') {
      if (isCod && !isPaymentCaptured) return 'orders.status_partner_assigned_cod';
      if (isPaymentCaptured && isCod) return 'orders.status_payment_received';
      return 'orders.status_partner_assigned';
    }
    return 'orders.status_placed';
  }

  String get partnerMessageKey {
    if (status == 'PENDING' || status == 'CANCELLED') return 'orders.partner_soon';
    return 'orders.partner_assigned';
  }

  @override
  List<Object?> get props => [id, orderNumber, status, grandTotalPaise, deliveryOtp];
}

class OrdersPage extends Equatable {
  const OrdersPage({required this.items, required this.hasNextPage, required this.page});

  final List<CustomerOrder> items;
  final bool hasNextPage;
  final int page;

  factory OrdersPage.fromJson(Map<String, dynamic> json) {
    final pagination = json['pagination'] as Map<String, dynamic>? ?? const {};
    final itemsJson = json['items'] as List<dynamic>? ?? const [];
    return OrdersPage(
      items: itemsJson.whereType<Map<String, dynamic>>().map(CustomerOrder.fromJson).toList(),
      hasNextPage: pagination['hasNextPage'] as bool? ?? false,
      page: (pagination['page'] as num?)?.toInt() ?? 1,
    );
  }

  @override
  List<Object?> get props => [items, hasNextPage, page];
}
