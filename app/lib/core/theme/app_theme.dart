import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_role.dart';
import 'customer/customer_theme.dart';
import 'delivery/delivery_theme.dart';

export 'app_role.dart';
export 'customer/customer_theme.dart';
export 'delivery/delivery_theme.dart';

/// Active product surface — drives ThemeData for the single DayFax app.
final appRoleProvider = StateProvider<AppRole>((ref) => AppRole.customer);

/// Force logistics theme on `/partner/login` and `/partner/otp` before role is known.
final partnerAuthSurfaceProvider = StateProvider<bool>((ref) => false);

abstract final class AppTheme {
  static ThemeData forRole(AppRole role) {
    return switch (role) {
      AppRole.customer => CustomerTheme.light(),
      AppRole.deliveryPartner => DeliveryTheme.light(),
    };
  }

  static ThemeData resolve({
    required AppRole role,
    required bool partnerAuthSurface,
  }) {
    if (partnerAuthSurface || role.isDeliveryPartner) {
      return DeliveryTheme.light();
    }
    return CustomerTheme.light();
  }
}
