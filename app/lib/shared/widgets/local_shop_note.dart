import 'package:flutter/material.dart';

import '../../core/i18n/i18n_providers.dart';
import '../../core/theme/customer/customer_colors.dart';
import '../../core/theme/customer/customer_radius.dart';
import '../../core/theme/customer/customer_spacing.dart';

class LocalShopNote extends StatelessWidget {
  const LocalShopNote({super.key});

  @override
  Widget build(BuildContext context) {
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(
              color: CustomerColors.primaryContainer,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.info_outline_rounded,
              size: 20,
              color: CustomerColors.onPrimaryContainer,
            ),
          ),
          const SizedBox(width: CustomerSpacing.sm + 4),
          Expanded(
            child: Text(
              context.t('local_shop.policy_note'),
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: CustomerColors.onPrimaryContainer,
                    fontWeight: FontWeight.w600,
                    height: 1.35,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
