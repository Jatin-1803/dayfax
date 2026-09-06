import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/theme/customer/customer_colors.dart';

class PriceText extends StatelessWidget {
  const PriceText({
    super.key,
    required this.paise,
    this.mrpPaise,
    this.style,
    this.showCurrency = true,
  });

  final int paise;
  final int? mrpPaise;
  final TextStyle? style;
  final bool showCurrency;

  static final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

  @override
  Widget build(BuildContext context) {
    final price = _inr.format(paise / 100);
    final baseStyle = style ??
        Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: CustomerColors.primary,
              fontWeight: FontWeight.w700,
            );

    if (mrpPaise == null || mrpPaise! <= paise) {
      return Text(showCurrency ? price : (paise / 100).toStringAsFixed(0), style: baseStyle);
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(price, style: baseStyle),
        const SizedBox(width: 6),
        Text(
          _inr.format(mrpPaise! / 100),
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: CustomerColors.onSurfaceVariant,
                decoration: TextDecoration.lineThrough,
              ),
        ),
      ],
    );
  }
}
