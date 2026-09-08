import 'package:flutter/material.dart';

import '../../core/i18n/i18n_providers.dart';
import '../../core/theme/customer/customer_colors.dart';
import '../../core/theme/customer/customer_radius.dart';
import '../../core/theme/customer/customer_spacing.dart';

class EtaBanner extends StatelessWidget {
  const EtaBanner({
    super.key,
    required this.etaMinutes,
    this.compact = false,
    this.message,
  });

  final int etaMinutes;
  final bool compact;
  final String? message;

  @override
  Widget build(BuildContext context) {
    final text = message ??
        (etaMinutes <= 0
            ? context.t('eta.unavailable')
            : context.t('eta.delivering_in', {'minutes': '$etaMinutes'}));

    if (compact) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.bolt_rounded, size: 16, color: CustomerColors.primary),
          const SizedBox(width: 4),
          Text(
            etaMinutes > 0 ? context.t('eta.mins', {'minutes': '$etaMinutes'}) : '—',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: CustomerColors.primary,
                  fontWeight: FontWeight.w800,
                ),
          ),
        ],
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: CustomerSpacing.md,
        vertical: CustomerSpacing.sm + 4,
      ),
      decoration: BoxDecoration(
        color: CustomerColors.primaryContainer.withValues(alpha: 0.22),
        borderRadius: BorderRadius.circular(CustomerRadius.md),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(
              color: CustomerColors.primaryContainer,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.delivery_dining_rounded,
              size: 20,
              color: CustomerColors.onPrimaryContainer,
            ),
          ),
          const SizedBox(width: CustomerSpacing.sm + 4),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: CustomerColors.onPrimaryContainer,
                    fontWeight: FontWeight.w800,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
