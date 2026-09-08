import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/routing/auth_gate.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../auth/presentation/auth_view_model.dart';

class PartnerAccountScreen extends ConsumerWidget {
  const PartnerAccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: DeliveryColors.background,
      appBar: AppBar(
        title: Text(ref.t('delivery.account.title')),
      ),
      body: Padding(
        padding: const EdgeInsets.all(DeliverySpacing.marginMobile),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(DeliverySpacing.lg),
              decoration: BoxDecoration(
                color: DeliveryColors.surfaceContainerLowest,
                borderRadius: BorderRadius.circular(DeliveryRadius.lg),
                border: Border.all(color: DeliveryColors.cardBorder),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: DeliveryColors.primaryContainer.withValues(alpha: 0.2),
                    child: const Icon(
                      Icons.local_shipping_rounded,
                      color: DeliveryColors.primary,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: DeliverySpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          ref.t('app.name'),
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        const SizedBox(height: DeliverySpacing.xs),
                        Text(
                          ref.t('delivery.account.signed_in'),
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: DeliveryColors.onSurfaceVariant,
                              ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Spacer(),
            AppButton(
              label: ref.t('common.log_out'),
              variant: AppButtonVariant.outline,
              onPressed: () async {
                await ref.read(authRepositoryProvider).logout();
                ref.read(isAuthenticatedProvider.notifier).state = false;
                ref.read(appRoleProvider.notifier).state = AppRole.customer;
                ref.read(partnerAuthSurfaceProvider.notifier).state = false;
                ref.invalidate(sessionBootstrapProvider);
                if (context.mounted) context.go('/login');
              },
            ),
          ],
        ),
      ),
    );
  }
}
