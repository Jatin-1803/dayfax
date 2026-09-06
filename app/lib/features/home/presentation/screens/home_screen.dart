import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/app_search_bar.dart';
import '../../../../shared/widgets/product_card.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../../catalog/presentation/catalog_view_models.dart';
import '../../../catalog/presentation/widgets/category_icon.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalogState = ref.watch(homeCatalogViewModelProvider);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: CustomerSpacing.marginMobile,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Delivery Location',
              style: Theme.of(context).textTheme.labelSmall,
            ),
            Row(
              children: [
                Text(
                  'Home',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const Icon(Icons.expand_more, size: 18),
              ],
            ),
          ],
        ),
        leading: const Padding(
          padding: EdgeInsets.only(left: CustomerSpacing.md),
          child: Icon(Icons.location_on, color: CustomerColors.primary),
        ),
        leadingWidth: 40,
        actions: [
          IconButton(
            onPressed: () {},
            icon: const Badge(
              smallSize: 8,
              child: Icon(Icons.notifications_outlined),
            ),
          ),
        ],
      ),
      body: switch (catalogState) {
        CatalogLoading() => const LoadingState(message: 'Loading catalog…'),
        CatalogError(:final message) => ErrorState(
            message: message,
            onRetry: () => ref.read(homeCatalogViewModelProvider.notifier).load(),
          ),
        CatalogReady(:final categories, :final products) => RefreshIndicator(
            color: CustomerColors.primary,
            onRefresh: () => ref.read(homeCatalogViewModelProvider.notifier).load(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                CustomerSpacing.marginMobile,
                CustomerSpacing.lg,
                CustomerSpacing.marginMobile,
                CustomerSpacing.lg,
              ),
              children: [
                AppSearchBar(
                  readOnly: true,
                  onTap: () => context.push('/search'),
                ),
                const SizedBox(height: CustomerSpacing.lg),
                if (categories.isEmpty)
                  Text(
                    'Categories coming soon',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: CustomerColors.onSurfaceVariant,
                        ),
                  )
                else
                  SizedBox(
                    height: 88,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: categories.length,
                      itemBuilder: (context, index) {
                        final category = categories[index];
                        return _CategoryChip(
                          label: category.name,
                          icon: iconForCategory(category.iconKey),
                          color: chipColorForIndex(index),
                          onTap: () => context.push('/category/${category.slug}'),
                        );
                      },
                    ),
                  ),
                const SizedBox(height: CustomerSpacing.lg),
                Text('Popular Near You', style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: CustomerSpacing.md),
                if (products.isEmpty)
                  const EmptyState(
                    title: 'No products yet',
                    message: 'Products will appear here once the store catalog is ready.',
                  )
                else
                  SizedBox(
                    height: 210,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: products.length,
                      separatorBuilder: (_, _) => const SizedBox(width: CustomerSpacing.md),
                      itemBuilder: (context, index) {
                        final product = products[index];
                        return ProductCard(
                          name: product.name,
                          subtitle: product.storeName.isEmpty
                              ? product.categoryName
                              : product.storeName,
                          pricePaise: product.pricePaise,
                          imageUrl: product.imageUrl ?? '',
                          onAdd: () {},
                          onTap: () => context.push('/products/${product.slug}'),
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),
      },
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: CustomerSpacing.lg),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(40),
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              child: Icon(icon, color: CustomerColors.onPrimaryContainer),
            ),
            const SizedBox(height: CustomerSpacing.xs),
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: CustomerColors.onSurface,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
