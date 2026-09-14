import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/product_card.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../../cart/presentation/widgets/cart_aware_product_card.dart';
import '../home_collections_view_model.dart';

class HomeFestivalRail extends ConsumerWidget {
  const HomeFestivalRail({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(homeCollectionsViewModelProvider);

    return switch (state) {
      HomeCollectionLoading() => const Padding(
          padding: EdgeInsets.only(top: CustomerSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SkeletonBox(width: 160, height: 22, borderRadius: 8),
              SizedBox(height: CustomerSpacing.sm),
              ProductCardRail(
                itemCount: 3,
                padding: EdgeInsets.zero,
                itemBuilder: _skeletonCard,
              ),
            ],
          ),
        ),
      HomeCollectionReady(:final collection) when collection != null => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: CustomerSpacing.lg),
            Text(
              collection.headline,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: CustomerSpacing.sm),
            ProductCardRail(
              itemCount: collection.products.length,
              padding: EdgeInsets.zero,
              itemBuilder: (context, index) {
                return CartAwareProductCard(product: collection.products[index]);
              },
            ),
          ],
        ),
      _ => const SizedBox.shrink(),
    };
  }
}

Widget _skeletonCard(BuildContext context, int index) {
  return const ProductCardSkeleton();
}
