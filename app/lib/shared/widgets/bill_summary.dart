import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/i18n/i18n_providers.dart';
import '../../core/theme/customer/customer_colors.dart';
import '../../core/theme/customer/customer_radius.dart';
import '../../core/theme/customer/customer_shadows.dart';
import '../../core/theme/customer/customer_spacing.dart';

class BillSummary extends StatelessWidget {
  const BillSummary({
    super.key,
    required this.itemTotalPaise,
    required this.deliveryFeePaise,
    this.taxPaise = 0,
    this.discountPaise = 0,
    this.grandTotalPaise,
    this.minOrderPaise,
    this.freeDeliveryAbovePaise,
    this.title,
  });

  final int itemTotalPaise;
  final int deliveryFeePaise;
  final int taxPaise;
  final int discountPaise;
  final int? grandTotalPaise;
  final int? minOrderPaise;
  final int? freeDeliveryAbovePaise;
  final String? title;

  static final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

  int get _grand =>
      grandTotalPaise ?? (itemTotalPaise + deliveryFeePaise + taxPaise - discountPaise);

  @override
  Widget build(BuildContext context) {
    final remainingForMin = (minOrderPaise != null && minOrderPaise! > itemTotalPaise)
        ? minOrderPaise! - itemTotalPaise
        : 0;
    final progress = minOrderPaise == null || minOrderPaise! <= 0
        ? 1.0
        : (itemTotalPaise / minOrderPaise!).clamp(0.0, 1.0);
    final showFreeAbove = freeDeliveryAbovePaise != null &&
        freeDeliveryAbovePaise! > 0 &&
        itemTotalPaise < freeDeliveryAbovePaise!;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(CustomerSpacing.md),
      decoration: BoxDecoration(
        color: CustomerColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(CustomerRadius.lg),
        boxShadow: CustomerShadows.level1,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title ?? context.t('bill.summary'), style: Theme.of(context).textTheme.titleMedium),
          if (minOrderPaise != null && minOrderPaise! > 0) ...[
            const SizedBox(height: CustomerSpacing.sm + 4),
            ClipRRect(
              borderRadius: BorderRadius.circular(CustomerRadius.full),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 6,
                backgroundColor: CustomerColors.surfaceContainerHigh,
                color: progress >= 1
                    ? CustomerColors.primaryContainer
                    : CustomerColors.secondaryContainer,
              ),
            ),
            const SizedBox(height: CustomerSpacing.sm),
            Text(
              remainingForMin > 0
                  ? context.t('bill.add_more_min', {
                      'amount': _inr.format(remainingForMin / 100),
                    })
                  : context.t('bill.min_met'),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: CustomerColors.onSurfaceVariant,
                  ),
            ),
          ],
          if (showFreeAbove) ...[
            const SizedBox(height: CustomerSpacing.sm),
            Text(
              context.t('bill.free_delivery_above', {
                'amount': _inr.format(freeDeliveryAbovePaise! / 100),
              }),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: CustomerColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
          const SizedBox(height: CustomerSpacing.md),
          _BillRow(label: context.t('bill.item_total'), paise: itemTotalPaise),
          const SizedBox(height: CustomerSpacing.sm),
          _BillRow(
            label: context.t('bill.delivery_fee'),
            paise: deliveryFeePaise,
            freeLabel: deliveryFeePaise == 0 ? context.t('common.free') : null,
          ),
          if (taxPaise > 0) ...[
            const SizedBox(height: CustomerSpacing.sm),
            _BillRow(label: context.t('bill.tax'), paise: taxPaise),
          ],
          if (discountPaise > 0) ...[
            const SizedBox(height: CustomerSpacing.sm),
            _BillRow(label: context.t('bill.discount'), paise: -discountPaise, emphasize: true),
          ],
          const Padding(
            padding: EdgeInsets.symmetric(vertical: CustomerSpacing.sm + 4),
            child: Divider(height: 1),
          ),
          _BillRow(label: context.t('bill.grand_total'), paise: _grand, bold: true),
        ],
      ),
    );
  }
}

class _BillRow extends StatelessWidget {
  const _BillRow({
    required this.label,
    required this.paise,
    this.bold = false,
    this.emphasize = false,
    this.freeLabel,
  });

  final String label;
  final int paise;
  final bool bold;
  final bool emphasize;
  final String? freeLabel;

  static final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.bodyMedium?.copyWith(
          fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
          color: emphasize ? CustomerColors.primary : null,
        );
    return Row(
      children: [
        Expanded(child: Text(label, style: style)),
        Text(
          freeLabel ?? _inr.format(paise / 100),
          style: style?.copyWith(
            color: freeLabel != null ? CustomerColors.primary : style.color,
            fontWeight: bold || freeLabel != null ? FontWeight.w800 : style.fontWeight,
          ),
        ),
      ],
    );
  }
}
