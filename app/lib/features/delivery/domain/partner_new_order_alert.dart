import 'package:equatable/equatable.dart';
import 'package:flutter/foundation.dart';

/// In-app high-priority alert for delivery partners when a new order arrives.
class PartnerNewOrderAlert extends Equatable {
  const PartnerNewOrderAlert({
    required this.orderId,
    required this.orderNumber,
    this.storeName,
    this.area,
    this.paymentMethod,
    this.amountPaise,
    this.receivedAt,
  });

  final String orderId;
  final String orderNumber;
  final String? storeName;
  final String? area;
  final String? paymentMethod;
  final int? amountPaise;
  final DateTime? receivedAt;

  bool get isCod => paymentMethod == 'COD';

  factory PartnerNewOrderAlert.fromPushData(Map<String, dynamic> data) {
    final amountRaw = data['amountPaise']?.toString();
    return PartnerNewOrderAlert(
      orderId: data['orderId']?.toString() ?? '',
      orderNumber: data['orderNumber']?.toString() ?? '',
      storeName: _nonEmpty(data['storeName']?.toString()),
      area: _nonEmpty(data['area']?.toString()),
      paymentMethod: _nonEmpty(data['paymentMethod']?.toString()),
      amountPaise: amountRaw == null || amountRaw.isEmpty ? null : int.tryParse(amountRaw),
      receivedAt: DateTime.now(),
    );
  }

  static String? _nonEmpty(String? value) {
    if (value == null) return null;
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  @override
  List<Object?> get props => [orderId, orderNumber, storeName, area, paymentMethod, amountPaise];
}

/// Active foreground new-order alert (null when dismissed / taken).
final partnerNewOrderAlert = ValueNotifier<PartnerNewOrderAlert?>(null);

/// Fired when another partner accepted an order we were showing.
final partnerOrderTakenSignal = ValueNotifier<String?>(null);

void presentPartnerNewOrderAlert(PartnerNewOrderAlert alert) {
  if (alert.orderId.isEmpty) return;
  partnerNewOrderAlert.value = alert;
}

void dismissPartnerNewOrderAlert({String? orderId}) {
  final current = partnerNewOrderAlert.value;
  if (current == null) return;
  if (orderId != null && current.orderId != orderId) return;
  partnerNewOrderAlert.value = null;
}

void signalPartnerOrderTaken(String orderId) {
  if (orderId.isEmpty) return;
  partnerOrderTakenSignal.value = orderId;
  dismissPartnerNewOrderAlert(orderId: orderId);
}
