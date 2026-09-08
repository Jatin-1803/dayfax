import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/app_search_bar.dart';
import '../../../../shared/widgets/product_card.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../../../shared/widgets/sticky_cart_bar.dart';
import '../../../cart/presentation/widgets/cart_aware_product_card.dart';
import '../../domain/catalog_models.dart';
import '../catalog_view_models.dart';
import '../widgets/category_tile.dart';

class CategoryProductsScreen extends ConsumerStatefulWidget {
  const CategoryProductsScreen({super.key, required this.categorySlug});

  final String categorySlug;

  @override
  ConsumerState<CategoryProductsScreen> createState() => _CategoryProductsScreenState();
}

class _CategoryProductsScreenState extends ConsumerState<CategoryProductsScreen> {
  final _filterController = TextEditingController();

  @override
  void dispose() {
    _filterController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(categoryProductsViewModelProvider(widget.categorySlug));
    final notifier = ref.read(categoryProductsViewModelProvider(widget.categorySlug).notifier);
    final title = state.title ?? ref.t('catalog.category');
    final total = state.pagination?.total;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title),
            if (total != null)
              Text(
                ref.t('catalog.product_count', {'count': '$total'}),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: CustomerColors.onSurfaceVariant,
                    ),
              ),
          ],
        ),
      ),
      body: StickyCartScaffoldBody(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                CustomerSpacing.marginMobile,
                CustomerSpacing.sm,
                CustomerSpacing.marginMobile,
                CustomerSpacing.sm,
              ),
              child: AppSearchBar(
                controller: _filterController,
                hintText: ref.t('catalog.search_in_category'),
                onChanged: notifier.onFilterChanged,
              ),
            ),
            if (state.subcategories.isNotEmpty)
              _SubCategoryRow(
                allLabel: ref.t('catalog.all'),
                subcategories: state.subcategories,
                selectedSlug: state.selectedSubSlug,
                onSelected: (slug) {
                  _filterController.clear();
                  notifier.selectSubCategory(slug);
                },
              ),
            Expanded(child: _buildBody(context, state, notifier)),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    ProductListState state,
    CategoryProductsViewModel notifier,
  ) {
    if (state.isLoading && state.items.isEmpty) {
      return GridView.builder(
        padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
        gridDelegate: homeSizedProductGridDelegate(context),
        itemCount: 6,
        itemBuilder: (_, _) => const Align(
          alignment: Alignment.topCenter,
          child: ProductCardSkeleton(),
        ),
      );
    }
    if (state.errorMessage != null && state.items.isEmpty) {
      return ErrorState(
        message: state.errorMessage!,
        onRetry: () => notifier.load(reset: true),
      );
    }
    if (state.items.isEmpty) {
      return EmptyState(
        title: ref.t('catalog.no_products'),
        message: state.query.isNotEmpty
            ? ref.t('catalog.nothing_found', {'query': state.query})
            : ref.t('catalog.no_products_message'),
      );
    }

    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification.metrics.pixels >= notification.metrics.maxScrollExtent - 200 &&
            state.hasMore &&
            !state.isLoadingMore) {
          notifier.load();
        }
        return false;
      },
      child: RefreshIndicator(
        color: CustomerColors.primary,
        onRefresh: () => notifier.load(reset: true),
        child: GridView.builder(
          padding: const EdgeInsets.fromLTRB(
            CustomerSpacing.marginMobile,
            CustomerSpacing.sm,
            CustomerSpacing.marginMobile,
            100,
          ),
          gridDelegate: homeSizedProductGridDelegate(context),
          itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
          itemBuilder: (context, index) {
            if (index >= state.items.length) {
              return const Center(child: CircularProgressIndicator());
            }
            return Align(
              alignment: Alignment.topCenter,
              child: CartAwareProductCard(product: state.items[index]),
            );
          },
        ),
      ),
    );
  }
}

class _SubCategoryRow extends StatelessWidget {
  const _SubCategoryRow({
    required this.allLabel,
    required this.subcategories,
    required this.selectedSlug,
    required this.onSelected,
  });

  final String allLabel;
  final List<CatalogCategory> subcategories;
  final String? selectedSlug;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 112,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(
          CustomerSpacing.marginMobile,
          CustomerSpacing.xs,
          CustomerSpacing.marginMobile,
          CustomerSpacing.sm,
        ),
        scrollDirection: Axis.horizontal,
        itemCount: subcategories.length + 1,
        separatorBuilder: (_, _) => const SizedBox(width: CustomerSpacing.sm),
        itemBuilder: (context, index) {
          if (index == 0) {
            return CategoryCircleChip(
              label: allLabel,
              iconKey: 'category',
              selected: selectedSlug == null,
              onTap: () => onSelected(null),
            );
          }
          final category = subcategories[index - 1];
          return CategoryCircleChip(
            label: category.name,
            iconKey: category.iconKey,
            imageUrl: category.imageUrl,
            selected: selectedSlug == category.slug,
            onTap: () => onSelected(category.slug),
          );
        },
      ),
    );
  }
}
