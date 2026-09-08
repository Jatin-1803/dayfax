import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/i18n/i18n_providers.dart';
import '../../core/theme/customer/customer_colors.dart';
import '../../core/theme/customer/customer_radius.dart';
import '../../core/theme/customer/customer_spacing.dart';
import '../../features/cart/presentation/cart_view_model.dart';

/// Floating “N items · ₹X · View cart” bar for browse screens.
class StickyCartBar extends ConsumerWidget {
  const StickyCartBar({
    super.key,
    this.bottomOffset = 0,
  });

  /// Extra space above the bottom (e.g. when nested under shell nav, leave 0
  /// if parent already pads; use MediaQuery padding when overlaying content).
  final double bottomOffset;

  static final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartViewModelProvider.select((s) => s.cart));
    if (cart.itemCount <= 0) return const SizedBox.shrink();

    final label = cart.itemCount == 1
        ? ref.t('cart.item_one')
        : ref.t('cart.item_n', {'count': '${cart.itemCount}'});

    return Padding(
      padding: EdgeInsets.fromLTRB(
        CustomerSpacing.marginMobile,
        0,
        CustomerSpacing.marginMobile,
        CustomerSpacing.sm + bottomOffset,
      ),
      child: Material(
        color: CustomerColors.primary,
        borderRadius: BorderRadius.circular(CustomerRadius.md),
        elevation: 0,
        shadowColor: Colors.transparent,
        child: InkWell(
          onTap: () => context.go('/cart'),
          borderRadius: BorderRadius.circular(CustomerRadius.md),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(CustomerRadius.md),
              boxShadow: [
                BoxShadow(
                  color: CustomerColors.primary.withValues(alpha: 0.28),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            padding: const EdgeInsets.fromLTRB(
              CustomerSpacing.md,
              CustomerSpacing.sm + 2,
              CustomerSpacing.sm,
              CustomerSpacing.sm + 2,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '$label  ·  ${_inr.format(cart.subtotalPaise / 100)}',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: CustomerColors.onPrimary,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: CustomerSpacing.md,
                    vertical: CustomerSpacing.sm - 1,
                  ),
                  decoration: BoxDecoration(
                    color: CustomerColors.surfaceContainerLowest,
                    borderRadius: BorderRadius.circular(CustomerRadius.full),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        ref.t('cart.view'),
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                              color: CustomerColors.primary,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      const SizedBox(width: CustomerSpacing.xs),
                      const Icon(
                        Icons.arrow_forward_rounded,
                        size: 18,
                        color: CustomerColors.primary,
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

/// Wraps [child] and shows [StickyCartBar] when the cart has items.
class StickyCartScaffoldBody extends ConsumerWidget {
  const StickyCartScaffoldBody({
    super.key,
    required this.child,
    this.showBar = true,
  });

  final Widget child;
  final bool showBar;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(cartItemCountProvider);
    return Stack(
      children: [
        Positioned.fill(child: child),
        if (showBar && count > 0)
          const Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: StickyCartBar(),
          ),
      ],
    );
  }
}
