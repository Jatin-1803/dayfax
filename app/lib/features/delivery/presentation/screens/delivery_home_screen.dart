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
import '../../../../shared/widgets/status_chip.dart';
import '../../domain/delivery_models.dart';
import '../delivery_view_models.dart';

class DeliveryHomeScreen extends ConsumerWidget {
  const DeliveryHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(deliveryStatsProvider);
    final activeJobs = ref.watch(deliveryJobsListProvider(DeliveryJobsTab.active));
    final currentJob = activeJobs.items.isNotEmpty ? activeJobs.items.first : null;

    return Scaffold(
      backgroundColor: DeliveryColors.background,
      appBar: AppBar(
        title: Text(ref.t('delivery.dashboard')),
        actions: [
          IconButton(
            tooltip: ref.t('common.refresh'),
            onPressed: () {
              ref.read(deliveryStatsProvider.notifier).refresh();
              ref.read(deliveryJobsListProvider(DeliveryJobsTab.active).notifier).refresh();
            },
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: DeliveryColors.primary,
        onRefresh: () async {
          await ref.read(deliveryStatsProvider.notifier).refresh();
          await ref.read(deliveryJobsListProvider(DeliveryJobsTab.active).notifier).refresh();
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(DeliverySpacing.marginMobile),
          children: [
            Text(
              ref.t('delivery.greeting'),
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: DeliveryColors.deepSlate,
                  ),
            ),
            const SizedBox(height: DeliverySpacing.xs),
            Text(
              ref.t('delivery.dashboard_hint'),
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DeliveryColors.onSurfaceVariant,
                  ),
            ),
            if (currentJob != null) ...[
              const SizedBox(height: DeliverySpacing.lg),
              Text(
                ref.t('delivery.current_delivery'),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: DeliverySpacing.sm),
              _CurrentDeliveryCard(
                job: currentJob,
                onView: () => context.push('/partner/jobs/${currentJob.detailRouteId}'),
              ),
            ],
            const SizedBox(height: DeliverySpacing.lg),
            statsAsync.when(
              loading: () => const _StatsSkeleton(),
              error: (error, _) => ErrorState(
                message: error is AppFailure ? error.message : 'delivery.could_not_load_stats',
                onRetry: () => ref.read(deliveryStatsProvider.notifier).refresh(),
              ),
              data: (stats) => _StatsGrid(stats: stats),
            ),
            const SizedBox(height: DeliverySpacing.xl),
            Text(ref.t('delivery.quick_actions'), style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: DeliverySpacing.sm),
            _ActionTile(
              icon: Icons.inventory_2_outlined,
              title: ref.t('delivery.pending_orders'),
              subtitle: ref.t('delivery.pending_hint'),
              onTap: () => context.go('/partner/jobs?tab=available'),
            ),
            _ActionTile(
              icon: Icons.local_shipping_outlined,
              title: ref.t('delivery.my_active'),
              subtitle: ref.t('delivery.my_active_hint'),
              onTap: () => context.go('/partner/jobs?tab=active'),
            ),
            _ActionTile(
              icon: Icons.check_circle_outline,
              title: ref.t('delivery.completed_today'),
              subtitle: ref.t('delivery.completed_hint'),
              onTap: () => context.go('/partner/history'),
            ),
          ],
        ),
      ),
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

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.stats});

  final DeliveryStats stats;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _StatCard(
            label: context.t('delivery.available'),
            value: stats.available.toString(),
            icon: Icons.inventory_2_outlined,
            color: DeliveryColors.primary,
          ),
        ),
        const SizedBox(width: DeliverySpacing.sm),
        Expanded(
          child: _StatCard(
            label: context.t('delivery.active'),
            value: stats.active.toString(),
            icon: Icons.local_shipping_outlined,
            color: DeliveryColors.secondary,
          ),
        ),
        const SizedBox(width: DeliverySpacing.sm),
        Expanded(
          child: _StatCard(
            label: context.t('delivery.done_today'),
            value: stats.completedToday.toString(),
            icon: Icons.check_circle_outline,
            color: DeliveryColors.tertiary,
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
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
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: DeliveryColors.deepSlate,
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: DeliverySpacing.xs),
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: DeliveryColors.onSurfaceVariant,
                ),
          ),
        ],
      ),
    );
  }
}

class _StatsSkeleton extends StatelessWidget {
  const _StatsSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        Expanded(child: SkeletonBox(height: 96, borderRadius: 16)),
        SizedBox(width: DeliverySpacing.sm),
        Expanded(child: SkeletonBox(height: 96, borderRadius: 16)),
        SizedBox(width: DeliverySpacing.sm),
        Expanded(child: SkeletonBox(height: 96, borderRadius: 16)),
      ],
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
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
      padding: const EdgeInsets.only(bottom: DeliverySpacing.sm),
      child: Material(
        color: DeliveryColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(DeliveryRadius.md),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(DeliveryRadius.md),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(DeliveryRadius.md),
              border: Border.all(color: DeliveryColors.cardBorder),
            ),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: DeliveryColors.primaryContainer.withValues(alpha: 0.15),
                child: Icon(icon, color: DeliveryColors.primary),
              ),
              title: Text(title),
              subtitle: Text(subtitle),
              trailing: const Icon(Icons.chevron_right),
            ),
          ),
        ),
      ),
    );
  }
}
