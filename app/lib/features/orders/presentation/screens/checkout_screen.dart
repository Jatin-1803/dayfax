import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_radius.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/bill_summary.dart';
import '../../../../shared/widgets/eta_banner.dart';
import '../../../../shared/widgets/price_text.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../../addresses/data/location_service.dart';
import '../../../addresses/domain/address_models.dart';
import '../../../addresses/presentation/widgets/address_form_sheet.dart';
import '../../../cart/presentation/cart_view_model.dart';
import '../../../notifications/presentation/notifications_view_model.dart';
import '../../domain/delivery_quote.dart';
import '../orders_view_models.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  late final Razorpay _razorpay;
  String? _pendingOrderId;
  static final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  void _onPaymentSuccess(PaymentSuccessResponse response) async {
    final orderId = _pendingOrderId;
    final razorpayOrderId = response.orderId;
    final paymentId = response.paymentId;
    final signature = response.signature;
    if (orderId == null ||
        razorpayOrderId == null ||
        paymentId == null ||
        signature == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.tr('checkout.payment_incomplete'))),
      );
      return;
    }

    final order = await ref.read(checkoutViewModelProvider.notifier).verifyRazorpayPayment(
          orderId: orderId,
          razorpayOrderId: razorpayOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
        );
    ref.invalidate(notificationsUnreadCountProvider);
    if (!mounted || order == null) return;
    context.go('/orders/${order.id}/confirmed');
  }

  void _onPaymentError(PaymentFailureResponse response) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(response.message ?? ref.tr('checkout.payment_failed')),
        backgroundColor: CustomerColors.error,
      ),
    );
  }

  void _onExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ref.tr('checkout.opening_wallet', {'wallet': response.walletName ?? ref.tr('checkout.wallet')}))),
    );
  }

  Future<void> _placeOrder() async {
    final result = await ref.read(checkoutViewModelProvider.notifier).placeOrder();
    if (!mounted || result == null) return;

    ref.invalidate(notificationsUnreadCountProvider);

    final razorpay = result.razorpay;
    if (razorpay == null) {
      context.go('/orders/${result.order.id}/confirmed');
      return;
    }

    _pendingOrderId = result.order.id;
    _razorpay.open({
      'key': razorpay.keyId,
      'amount': razorpay.amountPaise,
      'currency': razorpay.currency,
      'name': razorpay.name,
      'description': razorpay.description,
      'order_id': razorpay.orderId,
      'theme': {'color': '#006C49'},
    });
  }

  Future<void> _openAddressSheet() async {
    final pageContext = context;
    await showModalBottomSheet<void>(
      context: pageContext,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) {
        return Consumer(
          builder: (sheetBodyContext, sheetRef, _) {
            final checkout = sheetRef.watch(checkoutViewModelProvider);
            final notifier = sheetRef.read(checkoutViewModelProvider.notifier);
            final addresses = checkout.addresses;

            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  CustomerSpacing.marginMobile,
                  0,
                  CustomerSpacing.marginMobile,
                  CustomerSpacing.lg,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      sheetRef.t('home.select_delivery_location'),
                      style: Theme.of(sheetBodyContext).textTheme.titleLarge,
                    ),
                    const SizedBox(height: CustomerSpacing.md),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.my_location, color: CustomerColors.primary),
                      title: Text(sheetRef.t('home.use_current_location')),
                      subtitle: Text(sheetRef.t('home.detect_gps')),
                      onTap: () async {
                        Navigator.pop(sheetContext);
                        await Future<void>.delayed(const Duration(milliseconds: 50));
                        if (!pageContext.mounted) return;
                        await _useCurrentLocation(pageContext);
                      },
                    ),
                    const Divider(),
                    if (addresses.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: CustomerSpacing.md),
                        child: Text(sheetRef.t('home.no_saved_addresses')),
                      )
                    else
                      ConstrainedBox(
                        constraints: BoxConstraints(
                          maxHeight: MediaQuery.sizeOf(sheetBodyContext).height * 0.4,
                        ),
                        child: ListView.separated(
                          shrinkWrap: true,
                          itemCount: addresses.length,
                          separatorBuilder: (_, _) => const Divider(height: 1),
                          itemBuilder: (context, index) {
                            final address = addresses[index];
                            final selected = address.id == checkout.selectedAddressId;
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: Icon(
                                selected ? Icons.radio_button_checked : Icons.location_on_outlined,
                                color: selected
                                    ? CustomerColors.primary
                                    : CustomerColors.onSurfaceVariant,
                              ),
                              title: Text(
                                address.fullName?.trim().isNotEmpty == true
                                    ? '${address.label} · ${address.fullName}'
                                    : address.label,
                              ),
                              subtitle: Text(address.summaryLine),
                              onTap: () {
                                notifier.selectAddress(address.id);
                                sheetRef.invalidate(deliveryQuoteProvider(address.id));
                                Navigator.pop(sheetContext);
                              },
                            );
                          },
                        ),
                      ),
                    const SizedBox(height: CustomerSpacing.md),
                    OutlinedButton.icon(
                      onPressed: () async {
                        Navigator.pop(sheetContext);
                        await Future<void>.delayed(const Duration(milliseconds: 50));
                        if (!pageContext.mounted) return;
                        final saved = await showAddressFormSheet(pageContext);
                        if (!pageContext.mounted || !saved) return;
                        await ref.read(checkoutViewModelProvider.notifier).load();
                      },
                      icon: const Icon(Icons.add),
                      label: Text(sheetRef.t('home.add_new_address')),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _useCurrentLocation(BuildContext pageContext) async {
    final locationService = ref.read(locationServiceProvider);
    final messenger = ScaffoldMessenger.of(pageContext);
    final navigator = Navigator.of(pageContext, rootNavigator: true);

    try {
      await locationService.ensureReady();
    } on AppFailure catch (failure) {
      if (!pageContext.mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(ref.tr(failure.message))));
      return;
    } catch (_) {
      if (!pageContext.mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text(ref.tr('home.location_permission_failed'))),
      );
      return;
    }

    if (!pageContext.mounted) return;

    var dialogOpen = true;
    unawaited(
      showDialog<void>(
        context: pageContext,
        useRootNavigator: true,
        barrierDismissible: false,
        builder: (dialogContext) {
          return AlertDialog(
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(),
                const SizedBox(height: CustomerSpacing.md),
                Text(dialogContext.t('home.getting_location')),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () {
                  dialogOpen = false;
                  Navigator.of(dialogContext).pop();
                },
                child: Text(dialogContext.t('common.cancel')),
              ),
            ],
          );
        },
      ).whenComplete(() => dialogOpen = false),
    );

    void closeDialog() {
      if (!dialogOpen) return;
      dialogOpen = false;
      if (navigator.canPop()) {
        navigator.pop();
      }
    }

    try {
      final resolved = await locationService.resolveCurrentLocation(
        requestPermission: false,
      );
      if (!pageContext.mounted) return;
      closeDialog();
      final draft = AddressDraft(
        label: 'Home',
        line1: resolved.line1,
        line2: resolved.line2,
        city: resolved.city,
        state: resolved.state,
        pincode: resolved.pincode,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        isDefault: true,
      );
      final saved = await showAddressFormSheet(pageContext, prefill: draft);
      if (!pageContext.mounted || !saved) return;
      await ref.read(checkoutViewModelProvider.notifier).load();
    } on AppFailure catch (failure) {
      if (!pageContext.mounted) return;
      closeDialog();
      messenger.showSnackBar(
        SnackBar(
          content: Text(ref.tr(failure.message)),
          action: SnackBarAction(
            label: ref.tr('home.add_manually'),
            onPressed: () async {
              final saved = await showAddressFormSheet(pageContext);
              if (!pageContext.mounted || !saved) return;
              await ref.read(checkoutViewModelProvider.notifier).load();
            },
          ),
        ),
      );
    } catch (_) {
      if (!pageContext.mounted) return;
      closeDialog();
      messenger.showSnackBar(
        SnackBar(
          content: Text(ref.tr('home.location_timed_out')),
          action: SnackBarAction(
            label: ref.tr('home.add_manually'),
            onPressed: () async {
              final saved = await showAddressFormSheet(pageContext);
              if (!pageContext.mounted || !saved) return;
              await ref.read(checkoutViewModelProvider.notifier).load();
            },
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final checkout = ref.watch(checkoutViewModelProvider);
    final cart = ref.watch(cartViewModelProvider).cart;
    final notifier = ref.read(checkoutViewModelProvider.notifier);
    final quoteAsync = ref.watch(deliveryQuoteProvider(checkout.selectedAddressId));
    final quote = quoteAsync.asData?.value;

    if (cart.isEmpty && checkout.placedOrder == null) {
      return Scaffold(
        appBar: AppBar(title: Text(ref.t('checkout.title'))),
        body: EmptyState(
          title: ref.t('checkout.empty_title'),
          message: ref.t('checkout.empty_message'),
          actionLabel: ref.t('checkout.go_to_cart'),
          onAction: () => context.go('/cart'),
        ),
      );
    }

    final isOnline = checkout.paymentMethod != 'COD';
    final totalPaise = quote?.grandTotalPaise ?? cart.subtotalPaise;
    final selectedAddress = checkout.selectedAddress;

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('checkout.title'))),
      body: checkout.isLoading
          ? const CheckoutSkeleton()
          : ListView(
              padding: const EdgeInsets.fromLTRB(
                CustomerSpacing.marginMobile,
                CustomerSpacing.md,
                CustomerSpacing.marginMobile,
                CustomerSpacing.xl,
              ),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        ref.t('checkout.delivery_address'),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    if (selectedAddress != null)
                      TextButton(
                        onPressed: _openAddressSheet,
                        child: Text(ref.t('checkout.change')),
                      ),
                  ],
                ),
                const SizedBox(height: CustomerSpacing.sm),
                if (selectedAddress == null)
                  Material(
                    color: CustomerColors.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(CustomerRadius.lg),
                    child: Padding(
                      padding: const EdgeInsets.all(CustomerSpacing.lg),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            ref.t('checkout.no_address'),
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: CustomerSpacing.sm),
                          Text(
                            ref.t('checkout.add_address_to_order'),
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: CustomerColors.onSurfaceVariant,
                                ),
                          ),
                          const SizedBox(height: CustomerSpacing.md),
                          AppButton(
                            label: ref.t('checkout.add_address'),
                            onPressed: _openAddressSheet,
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  Material(
                    color: CustomerColors.primaryContainer.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(CustomerRadius.lg),
                    child: InkWell(
                      onTap: _openAddressSheet,
                      borderRadius: BorderRadius.circular(CustomerRadius.lg),
                      child: ListTile(
                        leading: const Icon(Icons.location_on, color: CustomerColors.primary),
                        title: Text(
                          selectedAddress.fullName?.trim().isNotEmpty == true
                              ? '${selectedAddress.label} · ${selectedAddress.fullName}'
                              : selectedAddress.label,
                        ),
                        subtitle: Text(selectedAddress.summaryLine),
                        trailing: const Icon(Icons.keyboard_arrow_up),
                      ),
                    ),
                  ),
                if (quote != null && quote.etaMinutes > 0) ...[
                  const SizedBox(height: CustomerSpacing.sm),
                  EtaBanner(etaMinutes: quote.etaMinutes),
                ],
                const SizedBox(height: CustomerSpacing.lg),
                Text(ref.t('common.payment'), style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: CustomerSpacing.sm),
                _PaymentCard(
                  selected: checkout.paymentMethod == 'COD',
                  title: ref.t('checkout.cod'),
                  subtitle: ref.t('checkout.cod_subtitle'),
                  icon: Icons.payments_outlined,
                  onTap: () => notifier.selectPaymentMethod('COD'),
                ),
                const SizedBox(height: CustomerSpacing.sm),
                _PaymentCard(
                  selected: checkout.paymentMethod == 'UPI',
                  title: ref.t('checkout.pay_online'),
                  subtitle: ref.t('checkout.pay_online_subtitle'),
                  icon: Icons.account_balance_wallet_outlined,
                  onTap: () => notifier.selectPaymentMethod('UPI'),
                ),
                const SizedBox(height: CustomerSpacing.lg),
                TextFormField(
                  decoration: InputDecoration(
                    labelText: ref.t('checkout.notes_optional'),
                  ),
                  maxLines: 2,
                  onChanged: notifier.setNotes,
                ),
                const SizedBox(height: CustomerSpacing.lg),
                Text(ref.t('checkout.order_summary'), style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: CustomerSpacing.sm),
                ...cart.items.map(
                  (item) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(item.product.name),
                    subtitle: Text('${item.unitLabel} × ${item.quantity}'),
                    trailing: PriceText(paise: item.lineTotalPaise),
                  ),
                ),
                const SizedBox(height: CustomerSpacing.md),
                BillSummary(
                  itemTotalPaise: quote?.itemTotalPaise ?? cart.subtotalPaise,
                  deliveryFeePaise: quote?.deliveryFeePaise ?? 0,
                  taxPaise: quote?.taxPaise ?? 0,
                  discountPaise: quote?.discountPaise ?? 0,
                  grandTotalPaise: quote?.grandTotalPaise,
                  minOrderPaise: quote?.minOrderPaise,
                  freeDeliveryAbovePaise: quote?.freeDeliveryAbovePaise,
                ),
                if (checkout.errorMessage != null) ...[
                  const SizedBox(height: CustomerSpacing.md),
                  Text(
                    ref.t(checkout.errorMessage!),
                    style: const TextStyle(color: CustomerColors.error),
                  ),
                ],
              ],
            ),
      bottomNavigationBar: checkout.addresses.isEmpty
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(
                  CustomerSpacing.marginMobile,
                  CustomerSpacing.sm,
                  CustomerSpacing.marginMobile,
                  CustomerSpacing.md,
                ),
                decoration: BoxDecoration(
                  color: CustomerColors.surfaceContainerLowest,
                  boxShadow: [
                    BoxShadow(
                      color: CustomerColors.onSurface.withValues(alpha: 0.06),
                      blurRadius: 16,
                      offset: const Offset(0, -4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          ref.t('common.total'),
                          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                                color: CustomerColors.onSurfaceVariant,
                              ),
                        ),
                        Text(
                          _inr.format(totalPaise / 100),
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: CustomerColors.primary,
                              ),
                        ),
                      ],
                    ),
                    const SizedBox(width: CustomerSpacing.md),
                    Expanded(
                      child: AppButton(
                        label: isOnline ? ref.t('checkout.pay_place_order') : ref.t('checkout.place_order'),
                        isLoading: checkout.isPlacing,
                        onPressed: checkout.isPlacing ? null : _placeOrder,
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

class _PaymentCard extends StatelessWidget {
  const _PaymentCard({
    required this.selected,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  final bool selected;
  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected
          ? CustomerColors.primaryContainer.withValues(alpha: 0.18)
          : CustomerColors.surfaceContainerLowest,
      borderRadius: BorderRadius.circular(CustomerRadius.lg),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(CustomerRadius.lg),
        child: ListTile(
          leading: Icon(icon, color: CustomerColors.primary),
          title: Text(title),
          subtitle: Text(subtitle),
          trailing: Icon(
            selected ? Icons.radio_button_checked : Icons.radio_button_off,
            color: selected ? CustomerColors.primary : CustomerColors.outline,
          ),
        ),
      ),
    );
  }
}
