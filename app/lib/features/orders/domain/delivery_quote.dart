import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/orders_repository.dart';

class DeliveryQuote extends Equatable {
  const DeliveryQuote({
    required this.etaMinutes,
    required this.deliveryFeePaise,
    required this.minOrderPaise,
    required this.itemTotalPaise,
    required this.itemCount,
    required this.taxPaise,
    required this.discountPaise,
    required this.grandTotalPaise,
    required this.meetsMinOrder,
    required this.amountToMinOrderPaise,
    this.addressId,
    this.deliveryZoneId,
    this.freeDeliveryAbovePaise,
    this.freeDeliveryApplied = false,
    this.distanceKm,
  });

  final String? addressId;
  final String? deliveryZoneId;
  final int etaMinutes;
  final int deliveryFeePaise;
  final int minOrderPaise;
  final int? freeDeliveryAbovePaise;
  final bool freeDeliveryApplied;
  final double? distanceKm;
  final int itemTotalPaise;
  final int itemCount;
  final int taxPaise;
  final int discountPaise;
  final int grandTotalPaise;
  final bool meetsMinOrder;
  final int amountToMinOrderPaise;

  factory DeliveryQuote.fromJson(Map<String, dynamic> json) {
    return DeliveryQuote(
      addressId: json['addressId'] as String?,
      deliveryZoneId: json['deliveryZoneId'] as String?,
      etaMinutes: (json['etaMinutes'] as num?)?.toInt() ?? 0,
      deliveryFeePaise: (json['deliveryFeePaise'] as num?)?.toInt() ?? 0,
      minOrderPaise: (json['minOrderPaise'] as num?)?.toInt() ?? 0,
      freeDeliveryAbovePaise: (json['freeDeliveryAbovePaise'] as num?)?.toInt(),
      freeDeliveryApplied: json['freeDeliveryApplied'] as bool? ?? false,
      distanceKm: (json['distanceKm'] as num?)?.toDouble(),
      itemTotalPaise: (json['itemTotalPaise'] as num?)?.toInt() ?? 0,
      itemCount: (json['itemCount'] as num?)?.toInt() ?? 0,
      taxPaise: (json['taxPaise'] as num?)?.toInt() ?? 0,
      discountPaise: (json['discountPaise'] as num?)?.toInt() ?? 0,
      grandTotalPaise: (json['grandTotalPaise'] as num?)?.toInt() ?? 0,
      meetsMinOrder: json['meetsMinOrder'] as bool? ?? true,
      amountToMinOrderPaise: (json['amountToMinOrderPaise'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [
        deliveryZoneId,
        etaMinutes,
        deliveryFeePaise,
        itemTotalPaise,
        freeDeliveryApplied,
      ];
}

/// Keeps the last quote warm for a short TTL after screens stop watching,
/// so home → product → cart navigation does not re-hit `/orders/quote` each time.
const Duration deliveryQuoteCacheTtl = Duration(seconds: 45);

final deliveryQuoteProvider =
    FutureProvider.autoDispose.family<DeliveryQuote, String?>((ref, addressId) async {
  final link = ref.keepAlive();
  Timer? disposeTimer;
  ref.onCancel(() {
    disposeTimer?.cancel();
    disposeTimer = Timer(deliveryQuoteCacheTtl, link.close);
  });
  ref.onResume(() {
    disposeTimer?.cancel();
  });
  ref.onDispose(() {
    disposeTimer?.cancel();
  });

  final repo = ref.watch(ordersRepositoryProvider);
  return repo.fetchQuote(addressId: addressId);
});
