import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/delivery/delivery_colors.dart';
import '../../../../core/theme/delivery/delivery_radius.dart';
import '../../../../core/theme/delivery/delivery_spacing.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../domain/delivery_models.dart';
import '../../domain/partner_day.dart';
import '../delivery_view_models.dart';
import '../widgets/partner_date_filter.dart';

final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

String formatCollectedRupees(int paise) => _inr.format((paise / 100).round());

class DeliveryHomeScreen extends ConsumerStatefulWidget {
  const DeliveryHomeScreen({super.key});

  @override
  ConsumerState<DeliveryHomeScreen> createState() => _DeliveryHomeScreenState();
}

class _DeliveryHomeScreenState extends ConsumerState<DeliveryHomeScreen> {
  late String _selectedDate = partnerToday();

  void _setDate(String date) {
    final next = parsePartnerDate(date);
    if (next == null) return;
    setState(() => _selectedDate = formatPartnerDate(next));
  }

  Future<void> _refresh() async {
    await ref.read(deliveryStatsProvider(_selectedDate).notifier).refresh();
    await Future.wait([
      ref
          .read(deliveryJobsListProvider(const DeliveryJobsQuery(DeliveryJobsTab.active)).notifier)
          .refresh(),
      ref
          .read(
            deliveryJobsListProvider(const DeliveryJobsQuery(DeliveryJobsTab.available)).notifier,
          )
          .refresh(),
    ]);
  }

  void _openAvailableJobs() {
    ref.invalidate(
      deliveryJobsListProvider(const DeliveryJobsQuery(DeliveryJobsTab.available)),
    );
    context.go('/partner/jobs?tab=available');
  }

  void _openActiveJobs() {
    ref.invalidate(
      deliveryJobsListProvider(const DeliveryJobsQuery(DeliveryJobsTab.active)),
    );
    context.go('/partner/jobs?tab=active');
  }

  @override
  Widget build(BuildContext context) {
    final statsAsync = ref.watch(deliveryStatsProvider(_selectedDate));
    final activeJobs = ref.watch(deliveryJobsListProvider(const DeliveryJobsQuery(DeliveryJobsTab.active)));
    final currentJob = activeJobs.items.isNotEmpty ? activeJobs.items.first : null;

    return Scaffold(
      backgroundColor: DeliveryColors.background,
      appBar: AppBar(
        title: Text(ref.t('delivery.dashboard')),
        actions: [
          IconButton(
            tooltip: ref.t('common.refresh'),
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: DeliveryColors.primary,
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(DeliverySpacing.marginMobile),
          children: [
            Text(
              ref.t('delivery.greeting'),
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: DeliveryColors.deepSlate,
                    fontWeight: FontWeight.w700,
                  ),
            ),
            if (currentJob != null) ...[
              const SizedBox(height: DeliverySpacing.lg),
              _CurrentDeliveryCard(
                job: currentJob,
                onView: () => context.push('/partner/jobs/${currentJob.detailRouteId}'),
              ),
            ],
            const SizedBox(height: DeliverySpacing.lg),
            PartnerDateFilter(
              selectedDate: _selectedDate,
              onChanged: _setDate,
            ),
            const SizedBox(height: DeliverySpacing.md),
            statsAsync.when(
              loading: () => const _DashboardSkeleton(),
              error: (error, _) => ErrorState(
                message: error is AppFailure ? error.message : ref.t('delivery.could_not_load_stats'),
                onRetry: () => ref.read(deliveryStatsProvider(_selectedDate).notifier).refresh(),
              ),
              data: (stats) => _DaySummary(
                stats: stats,
                onDelivered: () => context.go('/partner/history?date=$_selectedDate'),
                onReturns: () => context.go('/partner/history?date=$_selectedDate'),
                onAvailable: _openAvailableJobs,
                onActive: _openActiveJobs,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DaySummary extends StatelessWidget {
  const _DaySummary({
    required this.stats,
    required this.onDelivered,
    required this.onReturns,
    required this.onAvailable,
    required this.onActive,
  });

  final DeliveryStats stats;
  final VoidCallback onDelivered;
  final VoidCallback onReturns;
  final VoidCallback onAvailable;
  final VoidCallback onActive;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: _MoneyCard(
                label: context.t('delivery.cash_collected'),
                value: formatCollectedRupees(stats.cashCollectedPaise),
                icon: Icons.payments_outlined,
                color: DeliveryColors.primary,
              ),
            ),
            const SizedBox(width: DeliverySpacing.sm),
            Expanded(
              child: _MoneyCard(
                label: context.t('delivery.upi_collected'),
                value: formatCollectedRupees(stats.upiCollectedPaise),
                icon: Icons.qr_code_2,
                color: DeliveryColors.secondary,
              ),
            ),
          ],
        ),
        const SizedBox(height: DeliverySpacing.sm),
        Row(
          children: [
            Expanded(
              child: _CountCard(
                label: context.t('delivery.orders_delivered'),
                value: stats.ordersDelivered.toString(),
                icon: Icons.check_circle_outline,
                color: DeliveryColors.primary,
                onTap: onDelivered,
              ),
            ),
            const SizedBox(width: DeliverySpacing.sm),
            Expanded(
              child: _CountCard(
                label: context.t('delivery.cancelled'),
                value: stats.cancelled.toString(),
                icon: Icons.cancel_outlined,
                color: DeliveryColors.error,
              ),
            ),
            const SizedBox(width: DeliverySpacing.sm),
            Expanded(
              child: _CountCard(
                label: context.t('delivery.returns'),
                value: stats.returns.toString(),
                icon: Icons.assignment_return_outlined,
                color: DeliveryColors.tertiary,
                onTap: onReturns,
              ),
            ),
          ],
        ),
        const SizedBox(height: DeliverySpacing.lg),
        Text(
          context.t('delivery.right_now'),
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: DeliverySpacing.sm),
        Row(
          children: [
            Expanded(
              child: _CountCard(
                label: context.t('delivery.available'),
                value: stats.available.toString(),
                icon: Icons.inventory_2_outlined,
                color: DeliveryColors.primary,
                onTap: onAvailable,
              ),
            ),
            const SizedBox(width: DeliverySpacing.sm),
            Expanded(
              child: _CountCard(
                label: context.t('delivery.active'),
                value: stats.active.toString(),
                icon: Icons.local_shipping_outlined,
                color: DeliveryColors.secondary,
                onTap: onActive,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _CurrentDeliveryCard extends StatelessWidget {
  const _CurrentDeliveryCard({
    required this.job,
    required this.onView,
  });

  final DeliveryJob job;
  final VoidCallback onView;

  @override
  Widget build(BuildContext context) {
    final status = job.assignment?.status ?? job.orderStatus;
    return Container(
      padding: const EdgeInsets.all(DeliverySpacing.md),
      decoration: BoxDecoration(
        color: DeliveryColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(DeliveryRadius.lg),
        border: Border.all(color: DeliveryColors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  job.orderNumber,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
              StatusChip(status: status),
            ],
          ),
          const SizedBox(height: DeliverySpacing.sm),
          Text(
            job.store.name,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: DeliverySpacing.xs),
          Text(
            job.address.summary,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DeliveryColors.onSurfaceVariant,
                ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: DeliverySpacing.md),
          AppButton(
            label: context.t('delivery.view_delivery'),
            onPressed: onView,
          ),
        ],
      ),
    );
  }
}

class _MoneyCard extends StatelessWidget {
  const _MoneyCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(DeliverySpacing.md),
      decoration: BoxDecoration(
        color: DeliveryColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(DeliveryRadius.lg),
        border: Border.all(color: DeliveryColors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: DeliverySpacing.sm),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: DeliveryColors.deepSlate,
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: DeliverySpacing.xs),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: DeliveryColors.onSurfaceVariant,
                ),
          ),
        ],
      ),
    );
  }
}

class _CountCard extends StatelessWidget {
  const _CountCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final card = Container(
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
          Icon(icon, color: color, size: 20),
          const SizedBox(height: DeliverySpacing.sm),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: DeliveryColors.deepSlate,
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: DeliverySpacing.xs),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: DeliveryColors.onSurfaceVariant,
                ),
          ),
        ],
      ),
    );

    if (onTap == null) return card;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(DeliveryRadius.lg),
        child: card,
      ),
    );
  }
}

class _DashboardSkeleton extends StatelessWidget {
  const _DashboardSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        Row(
          children: [
            Expanded(child: SkeletonBox(height: 112, borderRadius: 16)),
            SizedBox(width: DeliverySpacing.sm),
            Expanded(child: SkeletonBox(height: 112, borderRadius: 16)),
          ],
        ),
        SizedBox(height: DeliverySpacing.sm),
        Row(
          children: [
            Expanded(child: SkeletonBox(height: 104, borderRadius: 16)),
            SizedBox(width: DeliverySpacing.sm),
            Expanded(child: SkeletonBox(height: 104, borderRadius: 16)),
            SizedBox(width: DeliverySpacing.sm),
            Expanded(child: SkeletonBox(height: 104, borderRadius: 16)),
          ],
        ),
      ],
    );
  }
}
