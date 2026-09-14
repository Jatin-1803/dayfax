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
import '../../../../shared/widgets/local_shop_note.dart';
import '../../../../shared/widgets/price_text.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../data/orders_repository.dart';
import '../../domain/order_models.dart';
import '../orders_view_models.dart';
import '../widgets/pay_online_button.dart';
import 'track_order_screen.dart';

class OrderDetailScreen extends ConsumerStatefulWidget {
  const OrderDetailScreen({super.key, required this.idOrNumber});

  final String idOrNumber;

  @override
  ConsumerState<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends ConsumerState<OrderDetailScreen>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _refresh());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant OrderDetailScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.idOrNumber != widget.idOrNumber) {
      _refresh();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refresh();
    }
  }

  void _refresh() {
    ref.read(orderDetailViewModelProvider(widget.idOrNumber).notifier).load(silent: true);
  }

  @override
  Widget build(BuildContext context) {
    final asyncOrder = ref.watch(orderDetailViewModelProvider(widget.idOrNumber));

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('orders.details'))),
      body: asyncOrder.when(
        loading: () => const OrderDetailSkeleton(),
        error: (error, _) => ErrorState(
          message: error is AppFailure ? error.message : 'orders.could_not_load',
          onRetry: () =>
              ref.read(orderDetailViewModelProvider(widget.idOrNumber).notifier).load(),
        ),
        data: (order) => RefreshIndicator(
          color: CustomerColors.primary,
          onRefresh: () =>
              ref.read(orderDetailViewModelProvider(widget.idOrNumber).notifier).load(silent: true),
          child: _OrderDetailBody(idOrNumber: widget.idOrNumber, order: order),
        ),
      ),
    );
  }
}

class _OrderDetailBody extends ConsumerStatefulWidget {
  const _OrderDetailBody({required this.idOrNumber, required this.order});

  final String idOrNumber;
  final CustomerOrder order;

  @override
  ConsumerState<_OrderDetailBody> createState() => _OrderDetailBodyState();
}

class _OrderDetailBodyState extends ConsumerState<_OrderDetailBody> {
  var _cancelling = false;

  CustomerOrder get order => widget.order;

  Future<void> _cancel() async {
    final paidOnline = order.payment != null &&
        order.payment!.method != 'COD' &&
        order.payment!.status == 'CAPTURED';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(context.t('orders.cancel_title')),
        content: Text(context.t(paidOnline ? 'orders.cancel_paid' : 'orders.cancel_body')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text(context.t('common.cancel'))),
          TextButton(onPressed: () => Navigator.pop(context, true), child: Text(context.t('orders.cancel_confirm'))),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _cancelling = true);
    try {
      await ref.read(ordersRepositoryProvider).cancel(order.id);
      ref.invalidate(orderDetailViewModelProvider(widget.idOrNumber));
      ref.invalidate(ordersListViewModelProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.t('orders.cancel_success'))),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.t(error is AppFailure ? error.message : 'orders.cancel_failed'))),
      );
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd MMM yyyy, hh:mm a');
    final timeline = order.timeline;
    final active = TrackOrderScreen.isActiveStatus(order.status);
    final request = order.returnRequest;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                order.linkedOrders.isEmpty
                    ? order.orderNumber
                    : '${order.orderNumber} · ${order.linkedOrders.first.orderNumber}',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
            ),
            _OrderStatusChips(order: order),
          ],
        ),
        const SizedBox(height: CustomerSpacing.xs),
        Text(
          dateFormat.format(order.placedAt.toLocal()),
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: CustomerColors.onSurfaceVariant,
              ),
        ),
        if (order.canPayOnline) ...[
          const SizedBox(height: CustomerSpacing.md),
          PayOnlineButton(
            order: order,
            onPaid: () => ref.invalidate(orderDetailViewModelProvider(widget.idOrNumber)),
          ),
        ],
        if (active) ...[
          const SizedBox(height: CustomerSpacing.md),
          AppButton(
            label: context.t('orders.track'),
            onPressed: () => context.push('/orders/${order.id}/track'),
          ),
        ],
        if (order.isLocalShop) ...[
          const SizedBox(height: CustomerSpacing.md),
          const LocalShopNote(),
        ],
        if (order.canCancel && !order.isLocalShop) ...[
          const SizedBox(height: CustomerSpacing.sm),
          AppButton(
            label: context.t('orders.cancel'),
            variant: AppButtonVariant.outline,
            isLoading: _cancelling,
            onPressed: _cancelling ? null : _cancel,
          ),
        ],
        if (order.canChatSupport) ...[
          const SizedBox(height: CustomerSpacing.md),
          AppButton(
            label: context.t('orders.chat_support'),
            onPressed: () => context.push('/orders/${order.id}/support'),
          ),
        ],
        if (request != null) ...[
          const SizedBox(height: CustomerSpacing.md),
          _ReturnCard(order: order, request: request),
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
            subtitle: Text(
              item.isLocalShop
                  ? '${item.variantLabel} × ${item.quantity} · ${context.t('local_shop.item_note')}'
                  : '${item.variantLabel} × ${item.quantity}',
            ),
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
          subtitle: Text(context.t(order.paymentMethodKey)),
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

class _OrderStatusChips extends StatelessWidget {
  const _OrderStatusChips({required this.order});

  final CustomerOrder order;

  @override
  Widget build(BuildContext context) {
    final request = order.returnRequest;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        StatusChip(status: order.status),
        if (request != null) ...[
          const SizedBox(height: CustomerSpacing.xs),
          StatusChip(
            status: request.status,
            label: context.t(request.chipKey),
          ),
        ],
      ],
    );
  }
}

class _ReturnCard extends StatelessWidget {
  const _ReturnCard({required this.order, required this.request});

  final CustomerOrder order;
  final OrderReturnRequest request;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(CustomerSpacing.md),
      decoration: BoxDecoration(
        color: CustomerColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(CustomerRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.t('returns.title'), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: CustomerSpacing.xs),
          Text(
            context.t('returns.for_order', {'orderNumber': order.orderNumber}),
            style: Theme.of(context).textTheme.titleSmall,
          ),
          if (order.storeName.trim().isNotEmpty) ...[
            const SizedBox(height: CustomerSpacing.xs),
            Text(
              order.storeName,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: CustomerColors.onSurfaceVariant,
                  ),
            ),
          ],
          const SizedBox(height: CustomerSpacing.sm),
          Text(context.t(request.statusKey)),
          if (request.items.isNotEmpty) ...[
            const SizedBox(height: CustomerSpacing.sm),
            Text(context.t('returns.items'), style: Theme.of(context).textTheme.titleSmall),
            for (final item in request.items)
              Padding(
                padding: const EdgeInsets.only(top: CustomerSpacing.xs),
                child: Text(_returnItemLine(item)),
              ),
          ],
          if (request.refundAmountPaise > 0) ...[
            const SizedBox(height: CustomerSpacing.sm),
            Text(context.t('returns.refund_amount'), style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: CustomerSpacing.xs),
            PriceText(paise: request.refundAmountPaise),
            const SizedBox(height: CustomerSpacing.xs),
            Text(
              context.t('returns.fee_not_refunded'),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: CustomerColors.onSurfaceVariant,
                  ),
            ),
          ],
          if (request.pickupCode != null) ...[
            const SizedBox(height: CustomerSpacing.sm),
            Text(context.t('returns.pickup_code')),
            Text(
              request.pickupCode!,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            Text(context.t('returns.pickup_code_hint')),
          ],
          if (request.adminNote != null && request.adminNote!.isNotEmpty) ...[
            const SizedBox(height: CustomerSpacing.sm),
            Text(request.adminNote!),
          ],
        ],
      ),
    );
  }

  String _returnItemLine(OrderReturnItem item) {
    final variant = item.variantLabel?.trim();
    final name = variant == null || variant.isEmpty
        ? item.productName
        : '${item.productName} · $variant';
    return '$name × ${item.quantity}';
  }
}
