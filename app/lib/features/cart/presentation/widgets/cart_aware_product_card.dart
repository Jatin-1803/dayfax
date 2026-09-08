import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/widgets/product_card.dart';
import '../../../catalog/domain/catalog_models.dart';
import '../cart_actions.dart';
import '../cart_view_model.dart';

/// Product card wired to cart quantity for the product's default variant.
class CartAwareProductCard extends ConsumerWidget {
  const CartAwareProductCard({
    super.key,
    required this.product,
    this.width = kProductCardRailWidth,
  });

  final CatalogProduct product;
  final double width;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final variantId = product.defaultVariant?.id;
    final quantity = variantId == null
        ? 0
        : ref.watch(cartQuantityByVariantProvider(variantId));
    final itemId = variantId == null
        ? null
        : ref.watch(cartItemIdByVariantProvider(variantId));

    return ProductCard(
      name: product.name,
      subtitle: product.defaultVariant?.unitLabel ?? product.categoryName,
      pricePaise: product.pricePaise,
      mrpPaise: product.mrpPaise,
      discountPercent: product.defaultVariant?.discountPercent ?? 0,
      imageUrl: product.imageUrl ?? '',
      width: width,
      quantity: quantity,
      enabled: product.inStock,
      onTap: () => context.push('/products/${product.slug}'),
      onAdd: () => addProductToCart(context, ref, product),
      onIncrement: () async {
        if (itemId == null || variantId == null) {
          await addProductToCart(context, ref, product);
          return;
        }
        await ref.read(cartViewModelProvider.notifier).setQuantity(itemId, quantity + 1);
      },
      onDecrement: () async {
        if (itemId == null) return;
        await ref.read(cartViewModelProvider.notifier).setQuantity(itemId, quantity - 1);
      },
    );
  }
}
