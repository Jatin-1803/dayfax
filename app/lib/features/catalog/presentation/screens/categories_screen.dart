import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_radius.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/app_search_bar.dart';
import '../../../../shared/widgets/product_card.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../../../shared/widgets/sticky_cart_bar.dart';
import '../../../cart/presentation/widgets/cart_aware_product_card.dart';
import '../../domain/catalog_models.dart';
import '../catalog_view_models.dart';
import '../widgets/category_icon.dart';
import '../widgets/category_tile.dart';

class CategoriesScreen extends ConsumerStatefulWidget {
  const CategoriesScreen({super.key});

  @override
  ConsumerState<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends ConsumerState<CategoriesScreen> {
  final _filterController = TextEditingController();
  String _filter = '';

  @override
  void dispose() {
    _filterController.dispose();
    super.dispose();
  }

  List<CatalogCategory> _filtered(List<CatalogCategory> categories) {
    final q = _filter.trim().toLowerCase();
    if (q.isEmpty) return categories;
    return categories
        .where((c) => c.name.toLowerCase().contains(q) || c.slug.toLowerCase().contains(q))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final asyncCategories = ref.watch(categoriesListViewModelProvider);
    final topSellingAsync = ref.watch(topSellingProductsViewModelProvider);
    final filterActive = _filter.trim().isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: Text(ref.t('catalog.categories')),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(64),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              CustomerSpacing.marginMobile,
              0,
              CustomerSpacing.marginMobile,
              CustomerSpacing.sm,
            ),
            child: AppSearchBar(
              controller: _filterController,
              hintText: ref.t('catalog.search_categories_hint'),
              onChanged: (value) => setState(() => _filter = value),
            ),
          ),
        ),
      ),
      body: StickyCartScaffoldBody(
        child: asyncCategories.when(
          loading: () => _CategoriesLoadingSkeleton(),
          error: (error, _) => ErrorState(
            message: error is AppFailure
                ? error.message
                : ref.t('catalog.could_not_load_categories'),
            onRetry: () => ref.read(categoriesListViewModelProvider.notifier).load(),
          ),
          data: (categories) {
            if (categories.isEmpty) {
              return EmptyState(
                title: ref.t('catalog.no_categories'),
                message: ref.t('catalog.no_categories_message'),
                icon: Icons.category_outlined,
              );
            }

            final visible = _filtered(categories);
            if (visible.isEmpty) {
              return EmptyState(
                title: ref.t('catalog.no_category_matches'),
                message: ref.t('catalog.no_category_matches_message'),
                icon: Icons.search_off,
              );
            }

            final topSelling = topSellingAsync.maybeWhen(
              data: (items) => items,
              orElse: () => const <CatalogProduct>[],
            );
            final topLoading = topSellingAsync.isLoading && topSelling.isEmpty;

            return CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      CustomerSpacing.marginMobile,
                      CustomerSpacing.md,
                      CustomerSpacing.marginMobile,
                      CustomerSpacing.sm,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          ref.t('home.shop_by_category'),
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                        const SizedBox(height: CustomerSpacing.xs),
                        Text(
                          ref.t('catalog.search_subtitle'),
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: CustomerColors.onSurfaceVariant,
                              ),
                        ),
                      ],
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(
                    CustomerSpacing.marginMobile,
                    CustomerSpacing.sm,
                    CustomerSpacing.marginMobile,
                    CustomerSpacing.md,
                  ),
                  sliver: SliverGrid(
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 4,
                      mainAxisSpacing: CustomerSpacing.md,
                      crossAxisSpacing: CustomerSpacing.sm,
                      childAspectRatio: 0.72 /
                          MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 1.35),
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final category = visible[index];
                        final originalIndex = categories.indexOf(category);
                        return CategoryTile(
                          label: category.name,
                          iconKey: category.iconKey,
                          imageUrl: category.imageUrl,
                          color: chipColorForIndex(
                            originalIndex < 0 ? index : originalIndex,
                          ),
                          compact: true,
                          onTap: () => context.push('/category/${category.slug}'),
                        );
                      },
                      childCount: visible.length,
                    ),
                  ),
                ),
                if (!filterActive) ...[
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(
                        CustomerSpacing.marginMobile,
                        CustomerSpacing.sm,
                        CustomerSpacing.marginMobile,
                        CustomerSpacing.sm,
                      ),
                      child: Text(
                        ref.t('catalog.top_selling'),
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                    ),
                  ),
                  if (topLoading)
                    SliverToBoxAdapter(
                      child: ProductCardRail(
                        itemCount: 4,
                        itemBuilder: (_, _) => const ProductCardSkeleton(),
                      ),
                    )
                  else if (topSelling.isNotEmpty)
                    SliverToBoxAdapter(
                      child: ProductCardRail(
                        itemCount: topSelling.length,
                        itemBuilder: (context, index) {
                          return CartAwareProductCard(product: topSelling[index]);
                        },
                      ),
                    ),
                ],
                const SliverToBoxAdapter(child: SizedBox(height: 100)),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _CategoriesLoadingSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(
        CustomerSpacing.marginMobile,
        CustomerSpacing.md,
        CustomerSpacing.marginMobile,
        100,
      ),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        mainAxisSpacing: CustomerSpacing.md,
        crossAxisSpacing: CustomerSpacing.sm,
        childAspectRatio: 0.72,
      ),
      itemCount: 12,
      itemBuilder: (_, _) => Column(
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: CustomerColors.surfaceContainer,
                borderRadius: BorderRadius.circular(CustomerRadius.md),
              ),
            ),
          ),
          const SizedBox(height: CustomerSpacing.xs),
          const SkeletonBox(width: 48, height: 10, borderRadius: 4),
        ],
      ),
    );
  }
}
