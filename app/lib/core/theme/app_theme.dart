import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_role.dart';
import 'customer/customer_theme.dart';
import 'delivery/delivery_theme.dart';

export 'app_role.dart';
export 'customer/customer_theme.dart';
export 'delivery/delivery_theme.dart';

/// Active product surface — drives ThemeData for the single Dailyfax app.
final appRoleProvider = StateProvider<AppRole>((ref) => AppRole.customer);

abstract final class AppTheme {
  static ThemeData forRole(AppRole role) {
    return switch (role) {
      AppRole.customer => CustomerTheme.light(),
      AppRole.deliveryPartner => DeliveryTheme.light(),
    };
  }
}
