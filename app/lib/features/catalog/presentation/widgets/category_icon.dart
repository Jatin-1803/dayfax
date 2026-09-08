import 'package:flutter/material.dart';

import '../../../../core/theme/customer/customer_colors.dart';

IconData iconForCategory(String? iconKey) {
  switch (iconKey) {
    case 'restaurant':
      return Icons.restaurant;
    case 'shopping_bag':
      return Icons.shopping_bag;
    case 'eco':
      return Icons.eco;
    case 'spa':
      return Icons.spa_outlined;
    case 'face':
      return Icons.face_retouching_natural;
    default:
      return Icons.category_outlined;
  }
}

Color chipColorForIndex(int index) {
  const colors = [
    CustomerColors.secondaryContainer,
    CustomerColors.primaryContainer,
    CustomerColors.tertiaryContainer,
  ];
  return colors[index % colors.length];
}
