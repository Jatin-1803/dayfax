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
              height: 1.15,
            ) ??
        const TextStyle(
          fontSize: 16,
          height: 1.15,
          fontWeight: FontWeight.w700,
          color: CustomerColors.primary,
        );

    if (mrpPaise == null || mrpPaise! <= paise) {
      return Text(showCurrency ? price : (paise / 100).toStringAsFixed(0), style: baseStyle);
    }

    return FittedBox(
      fit: BoxFit.scaleDown,
      alignment: Alignment.centerLeft,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(price, style: baseStyle, maxLines: 1),
          const SizedBox(width: 6),
          Text(
            _inr.format(mrpPaise! / 100),
            maxLines: 1,
            style: baseStyle.copyWith(
              color: CustomerColors.onSurfaceVariant,
              fontWeight: FontWeight.w500,
              decoration: TextDecoration.lineThrough,
              fontSize: (baseStyle.fontSize ?? 13) - 1,
            ),
          ),
        ],
      ),
    );
  }
}
