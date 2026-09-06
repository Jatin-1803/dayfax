import 'package:flutter/material.dart';

import 'customer_colors.dart';

abstract final class CustomerShadows {
  static List<BoxShadow> get level1 => [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.04),
          blurRadius: 20,
          offset: const Offset(0, 4),
        ),
      ];

  static List<BoxShadow> get level2 => [
        BoxShadow(
          color: CustomerColors.primaryContainer.withValues(alpha: 0.15),
          blurRadius: 24,
          offset: const Offset(0, 8),
        ),
      ];
}
