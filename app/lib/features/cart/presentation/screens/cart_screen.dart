import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_radius.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/bill_summary.dart';
import '../../../../shared/widgets/eta_banner.dart';
import '../../../../shared/widgets/price_text.dart';
import '../../../../shared/widgets/qty_stepper.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../../addresses/domain/address_models.dart';
import '../../../addresses/presentation/addresses_view_model.dart';
import '../../../orders/domain/delivery_quote.dart';
import '../../domain/cart_models.dart';
import '../cart_view_model.dart';

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  static final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(cartViewModelProvider);
    final notifier = ref.read(cartViewModelProvider.notifier);
    final addressesAsync = ref.watch(addressesViewModelProvider);
    final quoteAsync = ref.watch(deliveryQuoteProvider(null));
    final address = addressesAsync.maybeWhen(
      data: (list) {
        if (list.isEmpty) return null;
        return list.firstWhere((a) => a.isDefault, orElse: () => list.first);
      },
      orElse: () => null,
    );
    final quote = quoteAsync.asData?.value;

    return Scaffold(
      appBar: AppBar(
        title: Text(ref.t('cart.title')),
        actions: [
          if (!state.cart.isEmpty)
            TextButton(
              onPressed: state.isMutating ? null : notifier.clear,
              child: Text(ref.t('common.clear')),
            ),
        ],
      ),
      body: _buildBody(context, ref, state, notifier, address, quote),
      bottomNavigationBar: state.cart.isEmpty
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
                          _inr.format(
                            (quote?.grandTotalPaise ?? state.cart.subtotalPaise) / 100,
                          ),
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
                        label: ref.t('cart.proceed_checkout'),
                        onPressed: () => context.push('/checkout'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WidgetRef ref,
    CartUiState state,
    CartViewModel notifier,
    UserAddress? address,
    DeliveryQuote? quote,
  ) {
    if (state.isLoading && state.cart.isEmpty) {
      return ListView.separated(
        padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
        itemCount: 4,
        separatorBuilder: (_, _) => const SizedBox(height: CustomerSpacing.md),
        itemBuilder: (_, _) => const ListCardSkeleton(height: 88),
      );
    }
    if (state.errorMessage != null && state.cart.isEmpty) {
      return ErrorState(message: state.errorMessage!, onRetry: notifier.load);
    }
    if (state.cart.isEmpty) {
      return EmptyState(
        title: ref.t('cart.empty_title'),
        message: ref.t('cart.empty_message'),
        actionLabel: ref.t('cart.browse_categories'),
        onAction: () => context.go('/categories'),
      );
    }

    return RefreshIndicator(
      color: CustomerColors.primary,
      onRefresh: () async {
        await notifier.load();
        ref.invalidate(deliveryQuoteProvider(null));
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          CustomerSpacing.marginMobile,
          CustomerSpacing.md,
          CustomerSpacing.marginMobile,
          CustomerSpacing.xl,
        ),
        children: [
          Material(
            color: CustomerColors.surfaceContainerLow,
            borderRadius: BorderRadius.circular(CustomerRadius.md),
            child: ListTile(
              onTap: () => context.push('/addresses'),
              leading: const Icon(Icons.location_on, color: CustomerColors.primary),
              title: Text(address?.label ?? ref.t('cart.add_delivery_address')),
              subtitle: Text(
                address?.summaryLine ?? ref.t('cart.choose_deliver'),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: const Icon(Icons.chevron_right),
            ),
          ),
          if (quote != null && quote.etaMinutes > 0) ...[
            const SizedBox(height: CustomerSpacing.md),
            EtaBanner(etaMinutes: quote.etaMinutes),
          ],
          if (state.errorMessage != null) ...[
            const SizedBox(height: CustomerSpacing.md),
            Material(
              color: CustomerColors.errorContainer,
              borderRadius: BorderRadius.circular(CustomerRadius.md),
              child: Padding(
                padding: const EdgeInsets.all(CustomerSpacing.md),
                child: Text(
                  ref.t(state.errorMessage!),
                  style: const TextStyle(color: CustomerColors.error),
                ),
              ),
            ),
          ],
          const SizedBox(height: CustomerSpacing.lg),
          ...state.cart.items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: CustomerSpacing.md),
              child: _CartItemTile(
                item: item,
                enabled: !state.isMutating,
                onIncrement: () => notifier.setQuantity(item.id, item.quantity + 1),
                onDecrement: () => notifier.setQuantity(item.id, item.quantity - 1),
                onRemove: () => notifier.setQuantity(item.id, 0),
                onTap: () => context.push('/products/${item.product.slug}'),
              ),
            ),
          ),
          BillSummary(
            itemTotalPaise: quote?.itemTotalPaise ?? state.cart.subtotalPaise,
            deliveryFeePaise: quote?.deliveryFeePaise ?? 0,
            taxPaise: quote?.taxPaise ?? 0,
            discountPaise: quote?.discountPaise ?? 0,
            grandTotalPaise: quote?.grandTotalPaise,
            minOrderPaise: quote?.minOrderPaise,
            freeDeliveryAbovePaise: quote?.freeDeliveryAbovePaise,
          ),
        ],
      ),
    );
  }
}

class _CartItemTile extends StatelessWidget {
  const _CartItemTile({
    required this.item,
    required this.enabled,
    required this.onIncrement,
    required this.onDecrement,
    required this.onRemove,
    required this.onTap,
  });

  final CartItem item;
  final bool enabled;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final VoidCallback onRemove;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final imageUrl = item.product.imageUrl;
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
              color: CustomerColors.outlineVariant.withValues(alpha: 0.3),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(CustomerSpacing.sm + 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(CustomerRadius.sm),
                  child: SizedBox(
                    width: 72,
                    height: 72,
                    child: imageUrl == null || imageUrl.isEmpty
                        ? Container(
                            color: CustomerColors.surfaceContainer,
                            child: const Icon(Icons.image_not_supported_outlined),
                          )
                        : CachedNetworkImage(imageUrl: imageUrl, fit: BoxFit.cover),
                  ),
                ),
                const SizedBox(width: CustomerSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.product.name,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                      Text(
                        item.unitLabel,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: CustomerColors.onSurfaceVariant,
                            ),
                      ),
                      const SizedBox(height: CustomerSpacing.xs),
                      PriceText(paise: item.unitPricePaise, mrpPaise: item.mrpPaise),
                      if (item.priceChanged || item.exceedsStock)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            item.exceedsStock
                                ? context.t('cart.qty_exceeds_stock')
                                : context.t('cart.price_updated'),
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  color: CustomerColors.error,
                                ),
                          ),
                        ),
                      const SizedBox(height: CustomerSpacing.sm),
                      Row(
                        children: [
                          QtyStepper(
                            quantity: item.quantity,
                            enabled: enabled,
                            compact: true,
                            onIncrement: onIncrement,
                            onDecrement: onDecrement,
                          ),
                          const Spacer(),
                          IconButton(
                            onPressed: enabled ? onRemove : null,
                            icon: const Icon(Icons.delete_outline),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
