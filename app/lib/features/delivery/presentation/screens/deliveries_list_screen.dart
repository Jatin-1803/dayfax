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
import '../../domain/partner_day.dart';
import '../delivery_view_models.dart';
import '../widgets/collect_payment_sheet.dart';
import '../widgets/partner_date_filter.dart';

class DeliveriesListScreen extends ConsumerStatefulWidget {
  const DeliveriesListScreen({
    super.key,
    this.initialTab,
    this.initialDate,
    this.filterCompletedByDate = false,
  });

  final String? initialTab;
  final String? initialDate;
  final bool filterCompletedByDate;

  @override
  ConsumerState<DeliveriesListScreen> createState() => _DeliveriesListScreenState();
}

class _DeliveriesListScreenState extends ConsumerState<DeliveriesListScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  late DeliveryJobsTab _currentTab;
  late String _selectedDate;

  @override
  void initState() {
    super.initState();
    _currentTab = DeliveryJobsTab.fromQuery(widget.initialTab);
    _selectedDate = partnerDateOrToday(widget.initialDate);
    _tabController = TabController(
      length: DeliveryJobsTab.values.length,
      vsync: this,
      initialIndex: DeliveryJobsTab.values.indexOf(_currentTab),
    );
    _tabController.addListener(_onTabChanged);
    // Shell keeps this screen alive; always reload the visible tab on open.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _refreshTab(_currentTab);
    });
  }

  @override
  void didUpdateWidget(covariant DeliveriesListScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialTab != widget.initialTab) {
      final tab = DeliveryJobsTab.fromQuery(widget.initialTab);
      if (tab != _currentTab) {
        _currentTab = tab;
        _tabController.animateTo(DeliveryJobsTab.values.indexOf(tab));
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _refreshTab(tab);
        });
      }
    }
    if (widget.filterCompletedByDate && oldWidget.initialDate != widget.initialDate) {
      final next = partnerDateOrToday(widget.initialDate);
      if (next != _selectedDate) {
        setState(() => _selectedDate = next);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _refreshTab(DeliveryJobsTab.completed);
        });
      }
    }
  }

  DeliveryJobsQuery _queryFor(DeliveryJobsTab tab) {
    return DeliveryJobsQuery(
      tab,
      date: widget.filterCompletedByDate && tab == DeliveryJobsTab.completed
          ? _selectedDate
          : null,
    );
  }

  void _refreshTab(DeliveryJobsTab tab) {
    ref.read(deliveryJobsListProvider(_queryFor(tab)).notifier).refresh();
  }

  void _onTabChanged() {
    if (_tabController.indexIsChanging) return;
    final tab = DeliveryJobsTab.values[_tabController.index];
    if (tab != _currentTab) {
      setState(() => _currentTab = tab);
      _refreshTab(tab);
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
    final showDateFilter =
        widget.filterCompletedByDate && _currentTab == DeliveryJobsTab.completed;

    return Scaffold(
      backgroundColor: DeliveryColors.background,
      appBar: AppBar(
        title: Text(ref.t('delivery.tab_orders')),
        bottom: TabBar(
          controller: _tabController,
          tabs: DeliveryJobsTab.values.map((tab) => Tab(text: ref.t(_tabTitleKey(tab)))).toList(),
        ),
      ),
      body: Column(
        children: [
          if (showDateFilter)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                DeliverySpacing.marginMobile,
                DeliverySpacing.md,
                DeliverySpacing.marginMobile,
                0,
              ),
              child: PartnerDateFilter(
                selectedDate: _selectedDate,
                onChanged: (date) {
                  setState(() => _selectedDate = date);
                  context.go('/partner/history?date=$date');
                },
              ),
            ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: DeliveryJobsTab.values
                  .map(
                    (tab) => _JobsTabBody(
                      tab: tab,
                      date: widget.filterCompletedByDate && tab == DeliveryJobsTab.completed
                          ? _selectedDate
                          : null,
                    ),
                  )
                  .toList(),
            ),
          ),
        ],
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
  const _JobsTabBody({required this.tab, this.date});

  final DeliveryJobsTab tab;
  final String? date;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final query = DeliveryJobsQuery(tab, date: date);
    final state = ref.watch(deliveryJobsListProvider(query));
    final notifier = ref.read(deliveryJobsListProvider(query).notifier);
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
        message: _emptyMessage(context, tab, date: date),
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
              onOpenLocalShopMap: job.localShop?.canOpenMap == true
                  ? () async {
                      final opened = await PartnerNavigation.openShopMap(job.localShop!);
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

  String _emptyMessage(BuildContext context, DeliveryJobsTab tab, {String? date}) => switch (tab) {
        DeliveryJobsTab.available => context.t('delivery.empty_pending'),
        DeliveryJobsTab.active => context.t('delivery.empty_active'),
        DeliveryJobsTab.completed => date == null
            ? context.t('delivery.empty_completed')
            : context.t('delivery.empty_completed_day'),
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
    this.onOpenLocalShopMap,
  });

  final DeliveryJob job;
  final DeliveryJobsTab tab;
  final String dateLabel;
  final VoidCallback onOpen;
  final VoidCallback? onOpenMap;
  final VoidCallback? onOpenLocalShopMap;

  String get _ctaLabel {
    if (tab == DeliveryJobsTab.available || job.canClaim) {
      return job.isReturnPickup ? 'delivery.accept_pickup' : 'delivery.accept';
    }
    if (onOpenMap != null &&
        (job.assignment?.isAccepted == true || job.assignment?.isInProgress == true)) {
      return job.isReturnPickup ? 'delivery.go_to_customer' : 'delivery.go_to_map';
    }
    return job.isReturnPickup ? 'delivery.view_pickup' : 'delivery.view_delivery';
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
    if (job.isReturnPickup) return _returnTile(context);
    return _deliveryTile(context);
  }

  Widget _returnTile(BuildContext context) {
    final assignmentStatus = job.assignment?.status;
    final customer = job.customerName;

    return Container(
      decoration: BoxDecoration(
        color: DeliveryColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(DeliveryRadius.lg),
        border: Border.all(color: DeliveryColors.primary),
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
                        context.t(job.listTitleKey, {'orderNumber': job.orderNumber}),
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                    ),
                    StatusChip(
                      status: 'RETURN_PICKUP',
                      label: context.t('delivery.return_pickup_badge'),
                    ),
                  ],
                ),
                if (assignmentStatus != null) ...[
                  const SizedBox(height: DeliverySpacing.xs),
                  StatusChip(status: assignmentStatus),
                ],
                const SizedBox(height: DeliverySpacing.xs),
                Text(
                  dateLabel,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DeliveryColors.onSurfaceVariant,
                      ),
                ),
                const SizedBox(height: DeliverySpacing.sm),
                Text(
                  context.t('delivery.return_pickup'),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                if (customer != null) ...[
                  const SizedBox(height: DeliverySpacing.sm),
                  Text(
                    context.t(job.addressLabelKey),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DeliveryColors.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: DeliverySpacing.xs),
                  Text(customer, style: Theme.of(context).textTheme.bodyMedium),
                ],
                if (job.collectItems.isNotEmpty) ...[
                  const SizedBox(height: DeliverySpacing.sm),
                  Text(
                    context.t('delivery.collect_items'),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DeliveryColors.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  for (final item in job.collectItems.take(3))
                    Padding(
                      padding: const EdgeInsets.only(top: DeliverySpacing.xs),
                      child: Text(item.displayLine),
                    ),
                ],
                const SizedBox(height: DeliverySpacing.sm),
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

  Widget _deliveryTile(BuildContext context) {
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
                  job.isReturnPickup
                      ? context.t('delivery.return_pickup')
                      : job.needsCodCollection
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
                if (job.localShop != null) ...[
                  const SizedBox(height: DeliverySpacing.sm),
                  Text(
                    context.t('delivery.pickup'),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DeliveryColors.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: DeliverySpacing.xs),
                  Text(
                    job.localShop!.name,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  if (job.localShop!.displayPhone != null) ...[
                    const SizedBox(height: DeliverySpacing.xs),
                    Text(
                      '${context.t('delivery.shop_phone')}: ${job.localShop!.displayPhone}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                  if (job.localShop!.addressSummary.isNotEmpty) ...[
                    const SizedBox(height: DeliverySpacing.xs),
                    Text(
                      job.localShop!.addressSummary,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DeliveryColors.onSurfaceVariant,
                          ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  if (onOpenLocalShopMap != null) ...[
                    const SizedBox(height: DeliverySpacing.sm),
                    AppButton(
                      label: context.t('delivery.go_to_map'),
                      icon: Icons.map_outlined,
                      variant: AppButtonVariant.secondary,
                      onPressed: onOpenLocalShopMap,
                    ),
                  ],
                ],
                const SizedBox(height: DeliverySpacing.sm),
                if (job.localShop != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: DeliverySpacing.xs),
                    child: Text(
                      context.t('delivery.delivery_address'),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DeliveryColors.onSurfaceVariant,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ),
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
