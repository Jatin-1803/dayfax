import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_radius.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/local_shop_note.dart';
import '../../../../shared/widgets/delivery_otp_card.dart';
import '../../../../shared/widgets/price_text.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../orders_view_models.dart';
import '../widgets/pay_online_button.dart';

class OrderConfirmedScreen extends ConsumerStatefulWidget {
  const OrderConfirmedScreen({super.key, required this.idOrNumber});

  final String idOrNumber;

  @override
  ConsumerState<OrderConfirmedScreen> createState() => _OrderConfirmedScreenState();
}

class _OrderConfirmedScreenState extends ConsumerState<OrderConfirmedScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(orderDetailViewModelProvider(widget.idOrNumber).notifier).load(silent: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final asyncOrder = ref.watch(orderDetailViewModelProvider(widget.idOrNumber));

    return Scaffold(
      body: asyncOrder.when(
        loading: () => const SafeArea(child: OrderDetailSkeleton()),
        error: (error, _) => ErrorState(
          message: error is AppFailure ? error.message : 'orders.could_not_load',
          onRetry: () =>
              ref.read(orderDetailViewModelProvider(widget.idOrNumber).notifier).load(),
        ),
        data: (order) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
            child: Column(
              children: [
                const Spacer(),
                Container(
                  width: 96,
                  height: 96,
                  decoration: const BoxDecoration(
                    color: CustomerColors.primaryContainer,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check_rounded,
                    size: 56,
                    color: CustomerColors.onPrimaryContainer,
                  ),
                ),
                const SizedBox(height: CustomerSpacing.lg),
                Text(
                  order.status == 'PENDING'
                      ? ref.t('orders.placed_title')
                      : ref.t('orders.confirmed_title'),
                  style: Theme.of(context).textTheme.headlineMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: CustomerSpacing.sm),
                Text(
                  ref.t(order.statusMessageKey),
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: CustomerColors.onSurfaceVariant,
                      ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: CustomerSpacing.lg),
                if (order.isLocalShop) ...[
                  const LocalShopNote(),
                  const SizedBox(height: CustomerSpacing.lg),
                ],
                if (order.linkedOrders.isNotEmpty) ...[
                  for (final linked in order.linkedOrders)
                    Padding(
                      padding: const EdgeInsets.only(bottom: CustomerSpacing.sm),
                      child: Text(
                        ref.t('orders.linked_order', {'number': linked.orderNumber}),
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                    ),
                  const SizedBox(height: CustomerSpacing.sm),
                ],
                if (order.showDeliveryOtp) ...[
                  DeliveryOtpCard(otp: order.deliveryOtp!),
                  const SizedBox(height: CustomerSpacing.lg),
                ],
                Material(
                  color: CustomerColors.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(CustomerRadius.lg),
                  child: Padding(
                    padding: const EdgeInsets.all(CustomerSpacing.md),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            ref.t('orders.grand_total'),
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                        PriceText(paise: order.grandTotalPaise),
                      ],
                    ),
                  ),
                ),
                const Spacer(),
                if (order.canPayOnline) ...[
                  PayOnlineButton(
                    order: order,
                    onPaid: () => ref
                        .read(orderDetailViewModelProvider(widget.idOrNumber).notifier)
                        .load(),
                  ),
                  const SizedBox(height: CustomerSpacing.md),
                ],
                AppButton(
                  label: ref.t('orders.track'),
                  onPressed: () => context.go('/orders/${order.id}/track'),
                ),
                const SizedBox(height: CustomerSpacing.sm),
                AppButton(
                  label: ref.t('orders.back_home'),
                  variant: AppButtonVariant.outline,
                  onPressed: () => context.go('/home'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
