import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/delivery/delivery_colors.dart';
import '../../../../core/theme/delivery/delivery_radius.dart';
import '../../../../core/theme/delivery/delivery_spacing.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../delivery_view_models.dart';

class DeliverySuccessScreen extends ConsumerWidget {
  const DeliverySuccessScreen({super.key, required this.idOrOrderId});

  final String idOrOrderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncJob = ref.watch(deliveryJobDetailProvider(idOrOrderId));

    return Scaffold(
      backgroundColor: DeliveryColors.background,
      body: asyncJob.when(
        loading: () => const SafeArea(child: OrderDetailSkeleton()),
        error: (error, _) => ErrorState(
          message: error is AppFailure ? error.message : 'delivery.could_not_load',
          onRetry: () =>
              ref.read(deliveryJobDetailProvider(idOrOrderId).notifier).load(),
        ),
        data: (job) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(DeliverySpacing.marginMobile),
            child: Column(
              children: [
                const Spacer(),
                Container(
                  width: 96,
                  height: 96,
                  decoration: const BoxDecoration(
                    color: DeliveryColors.primaryContainer,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check_rounded,
                    size: 56,
                    color: DeliveryColors.onPrimaryContainer,
                  ),
                ),
                const SizedBox(height: DeliverySpacing.lg),
                Text(
                  ref.t('delivery.delivered_title'),
                  style: Theme.of(context).textTheme.headlineMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: DeliverySpacing.sm),
                Text(
                  ref.t('delivery.delivered_message', {'orderNumber': job.orderNumber}),
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: DeliveryColors.onSurfaceVariant,
                      ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: DeliverySpacing.lg),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(DeliverySpacing.md),
                  decoration: BoxDecoration(
                    color: DeliveryColors.surfaceContainerLowest,
                    borderRadius: BorderRadius.circular(DeliveryRadius.lg),
                    border: Border.all(color: DeliveryColors.cardBorder),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        job.orderNumber,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                      const SizedBox(height: DeliverySpacing.sm),
                      Row(
                        children: [
                          const Icon(
                            Icons.storefront_outlined,
                            size: 18,
                            color: DeliveryColors.primary,
                          ),
                          const SizedBox(width: DeliverySpacing.sm),
                          Expanded(child: Text(job.store.name)),
                        ],
                      ),
                      const SizedBox(height: DeliverySpacing.sm),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(
                            Icons.location_on_outlined,
                            size: 18,
                            color: DeliveryColors.primary,
                          ),
                          const SizedBox(width: DeliverySpacing.sm),
                          Expanded(
                            child: Text(
                              job.address.summary,
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: DeliveryColors.onSurfaceVariant,
                                  ),
                            ),
                          ),
                        ],
                      ),
                      if (job.customer != null) ...[
                        const SizedBox(height: DeliverySpacing.sm),
                        Row(
                          children: [
                            const Icon(
                              Icons.phone_outlined,
                              size: 18,
                              color: DeliveryColors.primary,
                            ),
                            const SizedBox(width: DeliverySpacing.sm),
                            Text(job.customer!.displayPhone),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                const Spacer(),
                AppButton(
                  label: ref.t('delivery.view_next'),
                  onPressed: () => context.go('/partner/jobs?tab=available'),
                ),
                const SizedBox(height: DeliverySpacing.sm),
                AppButton(
                  label: ref.t('delivery.back_to_deliveries'),
                  variant: AppButtonVariant.outline,
                  onPressed: () => context.go('/partner/jobs?tab=active'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
