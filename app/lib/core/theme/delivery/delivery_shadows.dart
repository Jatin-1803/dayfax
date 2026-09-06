import 'package:flutter/material.dart';

import 'delivery_colors.dart';

abstract final class DeliveryShadows {
  static List<BoxShadow> get ambient => [
        BoxShadow(
          color: DeliveryColors.deepSlate.withValues(alpha: 0.04),
          blurRadius: 20,
          offset: const Offset(0, 4),
        ),
      ];
}
