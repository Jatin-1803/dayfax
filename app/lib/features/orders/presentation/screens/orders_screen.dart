import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_radius.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/price_text.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../domain/order_models.dart';
import '../orders_view_models.dart';
import 'track_order_screen.dart';

class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(ordersListViewModelProvider);
    final notifier = ref.read(ordersListViewModelProvider.notifier);
    final dateFormat = DateFormat('dd MMM, hh:mm a');

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('orders.title'))),
      body: _buildBody(context, ref, state, notifier, dateFormat),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WidgetRef ref,
    OrdersListState state,
    OrdersListViewModel notifier,
    DateFormat dateFormat,
  ) {
    if (state.isLoading && state.items.isEmpty) {
      return ListView.separated(
        padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
        itemCount: 4,
        separatorBuilder: (_, _) => const SizedBox(height: CustomerSpacing.md),
        itemBuilder: (_, _) => const SkeletonBox(height: 96, borderRadius: 16),
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
        title: ref.t('orders.empty_title'),
        message: ref.t('orders.empty_message'),
        actionLabel: ref.t('orders.browse_store'),
        onAction: () => context.go('/home'),
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
        color: CustomerColors.primary,
        onRefresh: () => notifier.load(reset: true),
        child: ListView.separated(
          padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
          itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
          separatorBuilder: (_, _) => const SizedBox(height: CustomerSpacing.md),
          itemBuilder: (context, index) {
            if (index >= state.items.length) {
              return const Center(child: CircularProgressIndicator());
            }
            final order = state.items[index];
            final active = TrackOrderScreen.isActiveStatus(order.status);
            return _OrderTile(
              order: order,
              dateLabel: dateFormat.format(order.placedAt.toLocal()),
              onTap: () => context.push(
                active ? '/orders/${order.id}/track' : '/orders/${order.id}',
              ),
            );
          },
        ),
      ),
    );
  }
}

class _OrderTile extends StatelessWidget {
  const _OrderTile({
    required this.order,
    required this.dateLabel,
    required this.onTap,
  });

  final CustomerOrder order;
  final String dateLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: CustomerColors.surfaceContainerLowest,
      borderRadius: BorderRadius.circular(CustomerRadius.md),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(CustomerRadius.md),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(CustomerRadius.md),
            border: Border.all(
              color: CustomerColors.outlineVariant.withValues(alpha: 0.35),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(CustomerSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        order.orderNumber,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                    ),
                    StatusChip(status: order.status),
                  ],
                ),
                const SizedBox(height: CustomerSpacing.xs),
                Text(
                  dateLabel,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: CustomerColors.onSurfaceVariant,
                      ),
                ),
                const SizedBox(height: CustomerSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        order.storeName,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                    PriceText(paise: order.grandTotalPaise),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
