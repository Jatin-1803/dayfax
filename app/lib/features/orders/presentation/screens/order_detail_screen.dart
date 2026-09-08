import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_radius.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/bill_summary.dart';
import '../../../../shared/widgets/delivery_otp_card.dart';
import '../../../../shared/widgets/price_text.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../domain/order_models.dart';
import '../orders_view_models.dart';
import 'track_order_screen.dart';

class OrderDetailScreen extends ConsumerWidget {
  const OrderDetailScreen({super.key, required this.idOrNumber});

  final String idOrNumber;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncOrder = ref.watch(orderDetailViewModelProvider(idOrNumber));

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('orders.details'))),
      body: asyncOrder.when(
        loading: () => const OrderDetailSkeleton(),
        error: (error, _) => ErrorState(
          message: error is AppFailure ? error.message : 'orders.could_not_load',
          onRetry: () => ref.read(orderDetailViewModelProvider(idOrNumber).notifier).load(),
        ),
        data: (order) => _OrderDetailBody(order: order),
      ),
    );
  }
}

class _OrderDetailBody extends StatelessWidget {
  const _OrderDetailBody({required this.order});

  final CustomerOrder order;

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd MMM yyyy, hh:mm a');
    final timeline = order.timeline;
    final active = TrackOrderScreen.isActiveStatus(order.status);

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
        const SizedBox(height: CustomerSpacing.xs),
        Text(
          dateFormat.format(order.placedAt.toLocal()),
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: CustomerColors.onSurfaceVariant,
              ),
        ),
        if (active) ...[
          const SizedBox(height: CustomerSpacing.md),
          AppButton(
            label: context.t('orders.track'),
            onPressed: () => context.push('/orders/${order.id}/track'),
          ),
        ],
        if (order.showDeliveryOtp) ...[
          const SizedBox(height: CustomerSpacing.md),
          DeliveryOtpCard(otp: order.deliveryOtp!),
        ],
        const SizedBox(height: CustomerSpacing.lg),
        Text(context.t('orders.tracking'), style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: CustomerSpacing.sm),
        if (timeline == null)
          Text(context.t('orders.no_timeline'))
        else
          ...timeline.steps.map((step) {
            return ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                step.current
                    ? Icons.radio_button_checked
                    : step.reached
                        ? Icons.check_circle
                        : Icons.radio_button_unchecked,
                color: step.reached || step.current
                    ? CustomerColors.primary
                    : CustomerColors.outline,
              ),
              title: Text(context.t(StatusChip.displayLabel(step.status))),
            );
          }),
        const Divider(height: 32),
        Text(context.t('common.items'), style: Theme.of(context).textTheme.titleMedium),
        ...order.items.map(
          (item) => ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(item.productName),
            subtitle: Text('${item.variantLabel} × ${item.quantity}'),
            trailing: PriceText(paise: item.lineTotalPaise),
          ),
        ),
        const Divider(height: 32),
        Text(context.t('common.delivery'), style: Theme.of(context).textTheme.titleMedium),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(order.address.label),
          subtitle: Text(order.address.summary),
        ),
        Material(
          color: CustomerColors.surfaceContainerLow,
          borderRadius: BorderRadius.circular(CustomerRadius.md),
          child: ListTile(
            leading: const Icon(Icons.delivery_dining, color: CustomerColors.primary),
            title: Text(context.t('orders.delivery_partner')),
            subtitle: Text(context.t(order.partnerMessageKey)),
          ),
        ),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(context.t('common.payment')),
          subtitle: Text(context.t(order.statusMessageKey)),
        ),
        const SizedBox(height: CustomerSpacing.lg),
        BillSummary(
          itemTotalPaise: order.itemTotalPaise,
          deliveryFeePaise: order.deliveryFeePaise,
          taxPaise: order.taxPaise,
          discountPaise: order.discountPaise,
          grandTotalPaise: order.grandTotalPaise,
        ),
      ],
    );
  }
}
