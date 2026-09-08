import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_radius.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/bill_summary.dart';
import '../../../../shared/widgets/delivery_otp_card.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../domain/order_models.dart';
import '../orders_view_models.dart';

class TrackOrderScreen extends ConsumerWidget {
  const TrackOrderScreen({super.key, required this.idOrNumber});

  final String idOrNumber;

  static bool isActiveStatus(String status) {
    const active = {
      'PENDING',
      'CONFIRMED',
      'PREPARING',
      'READY_FOR_PICKUP',
      'PICKED_UP',
      'OUT_FOR_DELIVERY',
    };
    return active.contains(status.toUpperCase());
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncOrder = ref.watch(orderDetailViewModelProvider(idOrNumber));

    return Scaffold(
      appBar: AppBar(
        title: Text(ref.t('orders.track')),
        actions: [
          IconButton(
            onPressed: () =>
                ref.read(orderDetailViewModelProvider(idOrNumber).notifier).load(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: asyncOrder.when(
        loading: () => const OrderDetailSkeleton(),
        error: (error, _) => ErrorState(
          message: error is AppFailure ? error.message : 'orders.could_not_load',
          onRetry: () =>
              ref.read(orderDetailViewModelProvider(idOrNumber).notifier).load(),
        ),
        data: (order) => _TrackBody(order: order),
      ),
    );
  }
}

class _TrackBody extends StatelessWidget {
  const _TrackBody({required this.order});

  final CustomerOrder order;

  @override
  Widget build(BuildContext context) {
    final timeline = order.timeline;

    return ListView(
      padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(order.orderNumber, style: Theme.of(context).textTheme.headlineSmall),
            ),
            StatusChip(status: order.status),
          ],
        ),
        const SizedBox(height: CustomerSpacing.md),
        Material(
          color: CustomerColors.surfaceContainerLow,
          borderRadius: BorderRadius.circular(CustomerRadius.md),
          child: Padding(
            padding: const EdgeInsets.all(CustomerSpacing.md),
            child: Text(
              context.t(order.statusMessageKey),
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
        ),
        if (order.showDeliveryOtp) ...[
          const SizedBox(height: CustomerSpacing.md),
          DeliveryOtpCard(otp: order.deliveryOtp!),
        ],
        const SizedBox(height: CustomerSpacing.lg),
        Material(
          color: CustomerColors.surfaceContainerLowest,
          borderRadius: BorderRadius.circular(CustomerRadius.lg),
          child: Padding(
            padding: const EdgeInsets.all(CustomerSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(context.t('orders.delivery_partner'), style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: CustomerSpacing.sm),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const CircleAvatar(
                    backgroundColor: CustomerColors.primaryContainer,
                    child: Icon(Icons.delivery_dining, color: CustomerColors.onPrimaryContainer),
                  ),
                  title: Text(context.t(order.partnerMessageKey)),
                  subtitle: Text(
                    order.address.summary,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: CustomerSpacing.lg),
        Text(context.t('orders.timeline'), style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: CustomerSpacing.sm),
        if (timeline == null)
          Text(context.t('orders.no_timeline'))
        else
          _HorizontalDeliveryTimeline(steps: timeline.steps),
        const SizedBox(height: CustomerSpacing.lg),
        BillSummary(
          itemTotalPaise: order.itemTotalPaise,
          deliveryFeePaise: order.deliveryFeePaise,
          taxPaise: order.taxPaise,
          discountPaise: order.discountPaise,
          grandTotalPaise: order.grandTotalPaise,
        ),
        const SizedBox(height: CustomerSpacing.lg),
        AppButton(
          label: context.t('orders.details'),
          variant: AppButtonVariant.outline,
          onPressed: () => context.push('/orders/${order.id}'),
        ),
      ],
    );
  }
}

class _HorizontalDeliveryTimeline extends StatelessWidget {
  const _HorizontalDeliveryTimeline({required this.steps});

  final List<OrderTimelineStep> steps;

  static IconData _iconFor(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return Icons.receipt_long_rounded;
      case 'CONFIRMED':
        return Icons.done_rounded;
      case 'PREPARING':
        return Icons.soup_kitchen_outlined;
      case 'READY_FOR_PICKUP':
        return Icons.inventory_2_outlined;
      case 'PICKED_UP':
        return Icons.local_shipping_outlined;
      case 'OUT_FOR_DELIVERY':
        return Icons.delivery_dining_rounded;
      case 'DELIVERED':
        return Icons.home_outlined;
      default:
        return Icons.circle_outlined;
    }
  }

  static String _shortLabelKey(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return 'orders.status.placed';
      case 'CONFIRMED':
        return 'orders.status.confirmed';
      case 'PREPARING':
        return 'orders.status.preparing';
      case 'READY_FOR_PICKUP':
        return 'orders.status.ready';
      case 'PICKED_UP':
        return 'orders.status.picked';
      case 'OUT_FOR_DELIVERY':
        return 'orders.status.on_way';
      case 'DELIVERED':
        return 'orders.status.done';
      default:
        return StatusChip.displayLabel(status);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (steps.isEmpty) {
      return Text(context.t('orders.no_timeline'));
    }

    final currentIndex = steps.indexWhere((s) => s.current);
    final progressIndex = currentIndex >= 0
        ? currentIndex
        : steps.lastIndexWhere((s) => s.reached);

    return Material(
      color: CustomerColors.surfaceContainerLowest,
      borderRadius: BorderRadius.circular(CustomerRadius.lg),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          CustomerSpacing.md,
          CustomerSpacing.lg,
          CustomerSpacing.md,
          CustomerSpacing.md,
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            const minStepWidth = 72.0;
            final neededWidth = steps.length * minStepWidth;
            final useScroll = neededWidth > constraints.maxWidth;
            final contentWidth = useScroll ? neededWidth : constraints.maxWidth;

            final timeline = SizedBox(
              width: contentWidth,
              child: Column(
                children: [
                  SizedBox(
                    height: 40,
                    child: Stack(
                      alignment: Alignment.centerLeft,
                      children: [
                        Positioned(
                          left: 20,
                          right: 20,
                          child: _TimelineTrack(
                            stepCount: steps.length,
                            progressIndex: progressIndex < 0 ? 0 : progressIndex,
                          ),
                        ),
                        Row(
                          children: [
                            for (var i = 0; i < steps.length; i++)
                              Expanded(
                                child: _TimelineNode(
                                  step: steps[i],
                                  icon: _iconFor(steps[i].status),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: CustomerSpacing.sm),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final step in steps)
                        Expanded(
                          child: Text(
                            context.t(_shortLabelKey(step.status)),
                            textAlign: TextAlign.center,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  color: step.current
                                      ? CustomerColors.primary
                                      : step.reached
                                          ? CustomerColors.onSurface
                                          : CustomerColors.outline,
                                  fontWeight: step.current
                                      ? FontWeight.w700
                                      : FontWeight.w500,
                                  height: 1.2,
                                ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            );

            if (!useScroll) return timeline;

            return SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              child: timeline,
            );
          },
        ),
      ),
    );
  }
}

class _TimelineTrack extends StatelessWidget {
  const _TimelineTrack({
    required this.stepCount,
    required this.progressIndex,
  });

  final int stepCount;
  final int progressIndex;

  @override
  Widget build(BuildContext context) {
    if (stepCount <= 1) {
      return const SizedBox.shrink();
    }

    final fraction = (progressIndex / (stepCount - 1)).clamp(0.0, 1.0);

    return SizedBox(
      height: 3,
      child: Stack(
        children: [
          Container(
            decoration: BoxDecoration(
              color: CustomerColors.outlineVariant.withValues(alpha: 0.55),
              borderRadius: BorderRadius.circular(CustomerRadius.full),
            ),
          ),
          FractionallySizedBox(
            widthFactor: fraction,
            child: Container(
              decoration: BoxDecoration(
                color: CustomerColors.primary,
                borderRadius: BorderRadius.circular(CustomerRadius.full),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TimelineNode extends StatelessWidget {
  const _TimelineNode({
    required this.step,
    required this.icon,
  });

  final OrderTimelineStep step;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final isActive = step.current;
    final isDone = step.reached && !step.current;

    final Color bg;
    final Color fg;
    if (isActive) {
      bg = CustomerColors.primary;
      fg = CustomerColors.onPrimary;
    } else if (isDone) {
      bg = CustomerColors.primaryContainer;
      fg = CustomerColors.onPrimaryContainer;
    } else {
      bg = CustomerColors.surfaceContainerHigh;
      fg = CustomerColors.outline;
    }

    return Center(
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        width: isActive ? 36 : 30,
        height: isActive ? 36 : 30,
        decoration: BoxDecoration(
          color: bg,
          shape: BoxShape.circle,
          border: isActive
              ? Border.all(color: CustomerColors.primaryContainer, width: 3)
              : null,
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: CustomerColors.primary.withValues(alpha: 0.28),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Icon(
          isDone ? Icons.check_rounded : icon,
          size: isActive ? 18 : 15,
          color: fg,
        ),
      ),
    );
  }
}
