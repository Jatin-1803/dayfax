import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/customer/customer_colors.dart';
import '../../core/theme/customer/customer_radius.dart';
import '../../core/theme/customer/customer_spacing.dart';
import '../../core/i18n/i18n_providers.dart';

/// Zepto-style handover PIN card — large digits, easy to find on track/detail.
class DeliveryOtpCard extends StatelessWidget {
  const DeliveryOtpCard({super.key, required this.otp});

  final String otp;

  @override
  Widget build(BuildContext context) {
    final digits = otp.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) return const SizedBox.shrink();

    return Material(
      color: CustomerColors.secondaryContainer.withValues(alpha: 0.35),
      borderRadius: BorderRadius.circular(CustomerRadius.lg),
      child: InkWell(
        borderRadius: BorderRadius.circular(CustomerRadius.lg),
        onTap: () async {
          await Clipboard.setData(ClipboardData(text: digits));
          if (!context.mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(context.t('orders.delivery_otp_copied'))),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(CustomerSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.lock_outline_rounded,
                    size: 20,
                    color: CustomerColors.onSecondaryContainer,
                  ),
                  const SizedBox(width: CustomerSpacing.sm),
                  Expanded(
                    child: Text(
                      context.t('orders.delivery_otp_title'),
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: CustomerColors.onSecondaryContainer,
                          ),
                    ),
                  ),
                  Icon(
                    Icons.copy_rounded,
                    size: 18,
                    color: CustomerColors.onSecondaryContainer.withValues(alpha: 0.7),
                  ),
                ],
              ),
              const SizedBox(height: CustomerSpacing.sm),
              Text(
                context.t('orders.delivery_otp_hint'),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: CustomerColors.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: CustomerSpacing.md),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < digits.length; i++) ...[
                    if (i > 0) const SizedBox(width: CustomerSpacing.sm),
                    Container(
                      width: 52,
                      height: 64,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: CustomerColors.surfaceContainerLowest,
                        borderRadius: BorderRadius.circular(CustomerRadius.md),
                        border: Border.all(color: CustomerColors.secondary, width: 1.5),
                      ),
                      child: Text(
                        digits[i],
                        style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1,
                              color: CustomerColors.onSecondaryContainer,
                            ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
