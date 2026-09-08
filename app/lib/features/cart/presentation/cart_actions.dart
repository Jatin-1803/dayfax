import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/i18n/i18n_providers.dart';
import '../../../core/theme/customer/customer_colors.dart';
import '../../../core/theme/customer/customer_radius.dart';
import '../../../core/theme/customer/customer_spacing.dart';
import '../../catalog/domain/catalog_models.dart';
import 'cart_view_model.dart';

void showCartFlash(
  BuildContext context, {
  required String message,
  bool success = true,
  int itemCount = 0,
}) {
  final messenger = ScaffoldMessenger.of(context);
  messenger.hideCurrentSnackBar();

  final bottomInset = MediaQuery.paddingOf(context).bottom;
  // Sit just above the shell bottom nav (≈64) like Blinkit / Zepto.
  final bottomMargin = 72 + bottomInset;

  messenger.showSnackBar(
    SnackBar(
      behavior: SnackBarBehavior.floating,
      backgroundColor: Colors.transparent,
      elevation: 0,
      duration: const Duration(milliseconds: 2800),
      margin: EdgeInsets.fromLTRB(
        CustomerSpacing.md - 2,
        0,
        CustomerSpacing.md - 2,
        bottomMargin,
      ),
      padding: EdgeInsets.zero,
      content: _CartToast(
        message: message,
        success: success,
        itemCount: itemCount,
        onViewCart: success
            ? () {
                messenger.hideCurrentSnackBar();
                context.go('/cart');
              }
            : null,
      ),
    ),
  );
}

class _CartToast extends StatelessWidget {
  const _CartToast({
    required this.message,
    required this.success,
    required this.itemCount,
    this.onViewCart,
  });

  final String message;
  final bool success;
  final int itemCount;
  final VoidCallback? onViewCart;

  @override
  Widget build(BuildContext context) {
    final subtitle = success
        ? (itemCount <= 0
            ? context.t('cart.ready_checkout')
            : itemCount == 1
                ? context.t('cart.one_item')
                : context.t('cart.n_items', {'count': '$itemCount'}))
        : context.t('common.please_try_again');

    return Material(
      color: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.fromLTRB(
          CustomerSpacing.sm + 4,
          CustomerSpacing.sm + 2,
          CustomerSpacing.sm + 2,
          CustomerSpacing.sm + 2,
        ),
        decoration: BoxDecoration(
          color: CustomerColors.onSurface,
          borderRadius: BorderRadius.circular(CustomerRadius.md),
          boxShadow: [
            BoxShadow(
              color: CustomerColors.onSurface.withValues(alpha: 0.28),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: success
                    ? CustomerColors.primaryContainer
                    : CustomerColors.error.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: Icon(
                success ? Icons.check_rounded : Icons.error_outline_rounded,
                size: 20,
                color: success
                    ? CustomerColors.onPrimaryContainer
                    : CustomerColors.error,
              ),
            ),
            const SizedBox(width: CustomerSpacing.sm + 4),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    message,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: CustomerColors.surfaceContainerLowest,
                          fontWeight: FontWeight.w700,
                          height: 1.2,
                        ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: CustomerColors.surfaceContainerLowest.withValues(alpha: 0.72),
                          fontWeight: FontWeight.w500,
                          height: 1.2,
                        ),
                  ),
                ],
              ),
            ),
            if (onViewCart != null) ...[
              const SizedBox(width: CustomerSpacing.sm),
              Material(
                color: CustomerColors.secondaryContainer,
                borderRadius: BorderRadius.circular(CustomerRadius.full),
                child: InkWell(
                  onTap: onViewCart,
                  borderRadius: BorderRadius.circular(CustomerRadius.full),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: CustomerSpacing.md - 2,
                      vertical: CustomerSpacing.sm + 2,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          context.t('cart.view'),
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: CustomerColors.onSecondaryContainer,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                        const SizedBox(width: 2),
                        const Icon(
                          Icons.arrow_forward_ios_rounded,
                          size: 12,
                          color: CustomerColors.onSecondaryContainer,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

Future<void> addVariantToCart(
  BuildContext context,
  WidgetRef ref, {
  required String variantId,
  String? storeId,
}) async {
  final cart = ref.read(cartViewModelProvider).cart;
  final currentStoreId = cart.storeId;
  if (cart.itemCount > 0 &&
      storeId != null &&
      currentStoreId != null &&
      currentStoreId != storeId) {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(dialogContext.t('cart.replace_title')),
        content: Text(dialogContext.t('cart.replace_message')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(dialogContext.t('common.cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(dialogContext.t('cart.replace_confirm')),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
  }

  await HapticFeedback.mediumImpact();
  final ok = await ref.read(cartViewModelProvider.notifier).addVariant(
        variantId: variantId,
        storeId: storeId,
      );
  if (!context.mounted) return;

  if (ok) {
    await HapticFeedback.lightImpact();
  } else {
    await HapticFeedback.heavyImpact();
  }
  if (!context.mounted) return;

  final cartState = ref.read(cartViewModelProvider);
  showCartFlash(
    context,
    message: ok
        ? context.t('cart.added')
        : context.t(cartState.errorMessage ?? 'cart.could_not_add'),
    success: ok,
    itemCount: cartState.cart.itemCount,
  );
  if (ok) ref.read(cartViewModelProvider.notifier).consumeActionMessage();
}

Future<void> addProductToCart(
  BuildContext context,
  WidgetRef ref,
  CatalogProduct product,
) async {
  final variantId = product.defaultVariant?.id;
  if (variantId == null) {
    await HapticFeedback.heavyImpact();
    if (!context.mounted) return;
    showCartFlash(
      context,
      message: context.t('cart.no_variant'),
      success: false,
    );
    return;
  }
  await addVariantToCart(
    context,
    ref,
    variantId: variantId,
    storeId: product.storeId,
  );
}
