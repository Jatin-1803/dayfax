import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../notifications/presentation/notifications_view_model.dart';
import '../../data/orders_repository.dart';
import '../../domain/order_models.dart';
import '../orders_view_models.dart';

class PayOnlineButton extends ConsumerStatefulWidget {
  const PayOnlineButton({
    super.key,
    required this.order,
    required this.onPaid,
  });

  final CustomerOrder order;
  final VoidCallback onPaid;

  @override
  ConsumerState<PayOnlineButton> createState() => _PayOnlineButtonState();
}

class _PayOnlineButtonState extends ConsumerState<PayOnlineButton> {
  late final Razorpay _razorpay;
  var _paying = false;
  String? _orderId;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _onError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _onWallet);
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  Future<void> _start() async {
    if (_paying || !widget.order.canPayOnline) return;
    setState(() => _paying = true);
    try {
      final started = await ref.read(ordersRepositoryProvider).startOnlinePayment(widget.order.id);
      if (!mounted) return;
      if (started.alreadyPaid || started.razorpay == null) {
        setState(() => _paying = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ref.t('orders.pay_online_already_paid'))),
        );
        widget.onPaid();
        return;
      }
      _orderId = widget.order.id;
      _razorpay.open(started.razorpay!.toOpenOptions());
    } catch (error) {
      if (!mounted) return;
      setState(() => _paying = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ref.t(error is AppFailure ? error.message : 'orders.pay_online_failed')),
          backgroundColor: CustomerColors.error,
        ),
      );
    }
  }

  Future<void> _onSuccess(PaymentSuccessResponse response) async {
    final orderId = _orderId ?? widget.order.id;
    final razorpayOrderId = response.orderId;
    final paymentId = response.paymentId;
    final signature = response.signature;
    if (razorpayOrderId == null || paymentId == null || signature == null) {
      if (!mounted) return;
      setState(() => _paying = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.t('checkout.payment_incomplete'))),
      );
      return;
    }

    try {
      await ref.read(ordersRepositoryProvider).verifyPayment(
            orderId: orderId,
            razorpayOrderId: razorpayOrderId,
            razorpayPaymentId: paymentId,
            razorpaySignature: signature,
          );
      ref.invalidate(notificationsUnreadCountProvider);
      ref.invalidate(ordersListViewModelProvider);
      if (!mounted) return;
      setState(() => _paying = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.t('orders.pay_online_success'))),
      );
      widget.onPaid();
    } catch (error) {
      if (!mounted) return;
      setState(() => _paying = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ref.t(error is AppFailure ? error.message : 'orders.pay_online_failed')),
          backgroundColor: CustomerColors.error,
        ),
      );
    }
  }

  void _onError(PaymentFailureResponse response) {
    if (!mounted) return;
    setState(() => _paying = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ref.t('orders.pay_online_cancelled'))),
    );
  }

  void _onWallet(ExternalWalletResponse response) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ref.t('checkout.opening_wallet', {
            'wallet': response.walletName ?? ref.t('checkout.wallet'),
          }),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.order.canPayOnline) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppButton(
          label: ref.t('orders.pay_online_now'),
          isLoading: _paying,
          onPressed: _paying ? null : _start,
        ),
        const SizedBox(height: CustomerSpacing.xs),
        Text(
          ref.t('orders.pay_online_hint'),
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: CustomerColors.onSurfaceVariant,
              ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
