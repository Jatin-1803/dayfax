import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/legal_models.dart';

IconData aboutIcon(IconDataRef ref) {
  return switch (ref) {
    IconDataRef.description => Icons.description_outlined,
    IconDataRef.privacyTip => Icons.privacy_tip_outlined,
    IconDataRef.currencyExchange => Icons.currency_exchange_outlined,
    IconDataRef.groups => Icons.groups_outlined,
    IconDataRef.healthAndSafety => Icons.health_and_safety_outlined,
    IconDataRef.gavel => Icons.gavel_outlined,
    IconDataRef.info => Icons.info_outline,
    IconDataRef.mail => Icons.mail_outline,
    IconDataRef.balance => Icons.balance_outlined,
    IconDataRef.apps => Icons.apps_outlined,
  };
}

/// Matches Profile `_ProfileTile` styling for About navigation rows.
class AboutNavTile extends StatelessWidget {
  const AboutNavTile({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: CustomerSpacing.sm),
      child: Material(
        color: CustomerColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(CustomerRadius.md),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(CustomerRadius.md),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(CustomerRadius.md),
              border: Border.all(
                color: CustomerColors.outlineVariant.withValues(alpha: 0.3),
              ),
            ),
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(
                horizontal: CustomerSpacing.md,
                vertical: CustomerSpacing.xs,
              ),
              leading: CircleAvatar(
                backgroundColor: CustomerColors.surfaceContainer,
                child: Icon(icon, color: CustomerColors.primary, size: 22),
              ),
              title: Text(
                title,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              subtitle: Text(
                subtitle,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: CustomerColors.onSurfaceVariant,
                    ),
              ),
              trailing: const Icon(Icons.chevron_right),
            ),
          ),
        ),
      ),
    );
  }
}
