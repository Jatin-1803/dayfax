import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/delivery/delivery_colors.dart';
import '../../../../core/theme/delivery/delivery_radius.dart';
import '../../../../core/theme/delivery/delivery_spacing.dart';
import '../../../../core/utils/partner_navigation.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../domain/delivery_models.dart';
import '../delivery_view_models.dart';
import '../widgets/collect_payment_sheet.dart';

class DeliveriesListScreen extends ConsumerStatefulWidget {
  const DeliveriesListScreen({super.key, this.initialTab});

  final String? initialTab;

  @override
  ConsumerState<DeliveriesListScreen> createState() => _DeliveriesListScreenState();
}

class _DeliveriesListScreenState extends ConsumerState<DeliveriesListScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  late DeliveryJobsTab _currentTab;

  @override
  void initState() {
    super.initState();
    _currentTab = DeliveryJobsTab.fromQuery(widget.initialTab);
    _tabController = TabController(
      length: DeliveryJobsTab.values.length,
      vsync: this,
      initialIndex: DeliveryJobsTab.values.indexOf(_currentTab),
    );
    _tabController.addListener(_onTabChanged);
  }

  @override
  void didUpdateWidget(covariant DeliveriesListScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialTab != widget.initialTab) {
      final tab = DeliveryJobsTab.fromQuery(widget.initialTab);
      if (tab != _currentTab) {
        _currentTab = tab;
        _tabController.animateTo(DeliveryJobsTab.values.indexOf(tab));
      }
    }
  }

  void _onTabChanged() {
    if (_tabController.indexIsChanging) return;
    final tab = DeliveryJobsTab.values[_tabController.index];
    if (tab != _currentTab) {
      setState(() => _currentTab = tab);
    }
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: DeliveryColors.background,
      appBar: AppBar(
        title: Text(ref.t('delivery.tab_orders')),
        bottom: TabBar(
          controller: _tabController,
          tabs: DeliveryJobsTab.values.map((tab) => Tab(text: ref.t(_tabTitleKey(tab)))).toList(),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: DeliveryJobsTab.values
            .map((tab) => _JobsTabBody(tab: tab))
            .toList(),
      ),
    );
  }
}

String _tabTitleKey(DeliveryJobsTab tab) => switch (tab) {
      DeliveryJobsTab.available => 'delivery.tab_pending',
      DeliveryJobsTab.active => 'delivery.tab_my',
      DeliveryJobsTab.completed => 'delivery.tab_done',
    };

class _JobsTabBody extends ConsumerWidget {
  const _JobsTabBody({required this.tab});

  final DeliveryJobsTab tab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(deliveryJobsListProvider(tab));
    final notifier = ref.read(deliveryJobsListProvider(tab).notifier);
    final dateFormat = DateFormat('dd MMM, hh:mm a');

    if (state.isLoading && state.items.isEmpty) {
      return ListView.separated(
        padding: const EdgeInsets.all(DeliverySpacing.marginMobile),
        itemCount: 4,
        separatorBuilder: (_, _) => const SizedBox(height: DeliverySpacing.md),
        itemBuilder: (_, _) => const SkeletonBox(height: 140, borderRadius: 16),
      );
    }

    if (state.errorMessage != null && state.items.isEmpty) {
      return ErrorState(
        message: state.errorMessage!,
        onRetry: () => notifier.load(reset: true),
      );
    }

    if (state.items.isEmpty) {
      return EmptyState(
        title: _emptyTitle(context, tab),
        message: _emptyMessage(context, tab),
        icon: _emptyIcon(tab),
        actionLabel: tab == DeliveryJobsTab.available ? ref.t('delivery.back_dashboard') : null,
        onAction: tab == DeliveryJobsTab.available ? () => context.go('/partner/home') : null,
      );
    }

    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification.metrics.pixels >= notification.metrics.maxScrollExtent - 200 &&
            state.hasNextPage &&
            !state.isLoadingMore) {
          notifier.load();
        }
        return false;
      },
      child: RefreshIndicator(
        color: DeliveryColors.primary,
        onRefresh: notifier.refresh,
        child: ListView.separated(
          padding: const EdgeInsets.all(DeliverySpacing.marginMobile),
          itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
          separatorBuilder: (_, _) => const SizedBox(height: DeliverySpacing.md),
          itemBuilder: (context, index) {
            if (index >= state.items.length) {
              return const Center(
                child: Padding(
                  padding: EdgeInsets.all(DeliverySpacing.md),
                  child: CircularProgressIndicator(color: DeliveryColors.primary),
                ),
              );
            }
            final job = state.items[index];
            return _JobTile(
              job: job,
              tab: tab,
              dateLabel: dateFormat.format(job.placedAt.toLocal()),
              onOpen: () => context.push('/partner/jobs/${job.detailRouteId}'),
              onOpenMap: job.canOpenMap
                  ? () async {
                      final opened = await PartnerNavigation.openCustomerMap(job.address);
                      if (!opened && context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(context.t('delivery.maps_failed')),
                          ),
                        );
                      }
                    }
                  : null,
            );
          },
        ),
      ),
    );
  }

  String _emptyTitle(BuildContext context, DeliveryJobsTab tab) => switch (tab) {
        DeliveryJobsTab.available => context.t('delivery.no_pending'),
        DeliveryJobsTab.active => context.t('delivery.no_active'),
        DeliveryJobsTab.completed => context.t('delivery.no_completed'),
      };

  String _emptyMessage(BuildContext context, DeliveryJobsTab tab) => switch (tab) {
        DeliveryJobsTab.available => context.t('delivery.empty_pending'),
        DeliveryJobsTab.active => context.t('delivery.empty_active'),
        DeliveryJobsTab.completed => context.t('delivery.empty_completed'),
      };

  IconData _emptyIcon(DeliveryJobsTab tab) => switch (tab) {
        DeliveryJobsTab.available => Icons.inventory_2_outlined,
        DeliveryJobsTab.active => Icons.local_shipping_outlined,
        DeliveryJobsTab.completed => Icons.check_circle_outline,
      };
}

class _JobTile extends StatelessWidget {
  const _JobTile({
    required this.job,
    required this.tab,
    required this.dateLabel,
    required this.onOpen,
    this.onOpenMap,
  });

  final DeliveryJob job;
  final DeliveryJobsTab tab;
  final String dateLabel;
  final VoidCallback onOpen;
  final VoidCallback? onOpenMap;

  String get _ctaLabel {
    if (tab == DeliveryJobsTab.available || job.canClaim) {
      return 'delivery.accept';
    }
    if (onOpenMap != null &&
        (job.assignment?.isAccepted == true || job.assignment?.isInProgress == true)) {
      return 'delivery.go_to_map';
    }
    return 'delivery.view_delivery';
  }

  VoidCallback get _ctaAction {
    if (onOpenMap != null &&
        tab == DeliveryJobsTab.active &&
        (job.assignment?.isAccepted == true || job.assignment?.isInProgress == true)) {
      return onOpenMap!;
    }
    return onOpen;
  }

  @override
  Widget build(BuildContext context) {
    final status = job.assignment?.status ?? job.orderStatus;

    return Container(
      decoration: BoxDecoration(
        color: DeliveryColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(DeliveryRadius.lg),
        border: Border.all(color: DeliveryColors.cardBorder),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onOpen,
          borderRadius: BorderRadius.circular(DeliveryRadius.lg),
          child: Padding(
            padding: const EdgeInsets.all(DeliverySpacing.md),
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
                const SizedBox(height: DeliverySpacing.xs),
                Text(
                  dateLabel,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DeliveryColors.onSurfaceVariant,
                      ),
                ),
                const SizedBox(height: DeliverySpacing.xs),
                Text(
                  job.needsCodCollection
                      ? context.t('delivery.cod_collect', {
                          'amount': formatDeliveryPaise(
                            job.payment?.collectAmountPaise ?? job.grandTotalPaise,
                          ),
                        })
                      : context.t('delivery.paid_online'),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: DeliverySpacing.sm),
                Text(
                  job.store.name,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: DeliverySpacing.xs),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.location_on_outlined,
                      size: 16,
                      color: DeliveryColors.onSurfaceVariant,
                    ),
                    const SizedBox(width: DeliverySpacing.xs),
                    Expanded(
                      child: Text(
                        job.address.summary,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DeliveryColors.onSurfaceVariant,
                            ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: DeliverySpacing.md),
                AppButton(
                  label: context.t(_ctaLabel),
                  onPressed: _ctaAction,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
