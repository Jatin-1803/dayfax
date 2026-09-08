import 'package:flutter/material.dart';

import 'delivery/delivery_colors.dart';

/// True when [DeliveryTheme] is active (partner screens or partner auth).
bool isDeliveryTheme(BuildContext context) {
  return Theme.of(context).scaffoldBackgroundColor == DeliveryColors.background;
}
