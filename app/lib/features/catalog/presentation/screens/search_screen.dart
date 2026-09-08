import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/app_search_bar.dart';
import '../../../../shared/widgets/product_card.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../../../shared/widgets/sticky_cart_bar.dart';
import '../../../cart/presentation/widgets/cart_aware_product_card.dart';
import '../../../shops/domain/shop_models.dart';
import '../../../shops/presentation/shops_view_models.dart';
import '../../domain/catalog_models.dart';
import '../catalog_view_models.dart';
import '../widgets/category_icon.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  late final TextEditingController _controller;
  final _focusNode = FocusNode();
  List<String> _recent = const [];

  static const _recentKey = 'search_recent_queries';

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
    _loadRecent();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
  }

  Future<void> _loadRecent() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() => _recent = prefs.getStringList(_recentKey) ?? const []);
  }

  Future<void> _saveRecent(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return;
    final next = [trimmed, ..._recent.where((q) => q != trimmed)].take(8).toList();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_recentKey, next);
    if (mounted) setState(() => _recent = next);
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  List<CatalogCategory> _matchCategories(String query, List<CatalogCategory> categories) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return const [];
    return categories
        .where((c) => c.name.toLowerCase().contains(q) || c.slug.toLowerCase().contains(q))
        .take(8)
        .toList();
  }

  List<ShopSummary> _matchShops(String query, List<ShopSummary> shops) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return const [];
    return shops
        .where(
          (s) =>
              s.name.toLowerCase().contains(q) ||
              s.slug.toLowerCase().contains(q) ||
              (s.city?.toLowerCase().contains(q) ?? false),
        )
        .take(6)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(searchViewModelProvider);
    final notifier = ref.read(searchViewModelProvider.notifier);
    final categoriesAsync = ref.watch(categoriesListViewModelProvider);
    final shopsState = ref.watch(popularShopsViewModelProvider);

    final categories = categoriesAsync.maybeWhen(
      data: (list) => list,
      orElse: () => const <CatalogCategory>[],
    );
    final matchedCategories = _matchCategories(state.query, categories);
    final matchedShops = _matchShops(state.query, shopsState.shops);

    return Scaffold(
      appBar: AppBar(
        title: Text(ref.t('catalog.search')),
      ),
      body: StickyCartScaffoldBody(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                CustomerSpacing.marginMobile,
                CustomerSpacing.md,
                CustomerSpacing.marginMobile,
                CustomerSpacing.sm,
              ),
              child: AppSearchBar(
                controller: _controller,
                focusNode: _focusNode,
                autofocus: true,
                onChanged: notifier.onQueryChanged,
                onSubmitted: (value) {
                  notifier.onQueryChanged(value);
                  notifier.search(reset: true);
                  _saveRecent(value);
                },
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (state.rewrittenFor != null && state.rewrittenFor!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                        CustomerSpacing.marginMobile,
                        0,
                        CustomerSpacing.marginMobile,
                        CustomerSpacing.sm,
                      ),
                      child: Text(
                        ref.t('catalog.showing_for', {'term': state.rewrittenFor!}),
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: CustomerColors.onSurfaceVariant,
                            ),
                      ),
                    ),
                  Expanded(
                    child: _buildResults(
                      context,
                      state,
                      notifier,
                      categories: categories,
                      matchedCategories: matchedCategories,
                      matchedShops: matchedShops,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResults(
    BuildContext context,
    ProductListState state,
    SearchViewModel notifier, {
    required List<CatalogCategory> categories,
    required List<CatalogCategory> matchedCategories,
    required List<ShopSummary> matchedShops,
  }) {
    if (state.query.isEmpty) {
      final topSellingAsync = ref.watch(topSellingProductsViewModelProvider);
      return _IdleSearchBody(
        recent: _recent,
        categories: categories.take(8).toList(),
        topSelling: topSellingAsync.maybeWhen(
          data: (items) => items,
          orElse: () => const <CatalogProduct>[],
        ),
        topSellingLoading: topSellingAsync.isLoading,
        onRecentTap: (query) {
          _controller.text = query;
          notifier.onQueryChanged(query);
          notifier.search(reset: true);
        },
        onCategoryTap: (slug) => context.push('/category/$slug'),
      );
    }

    final hasEntityMatches = matchedCategories.isNotEmpty || matchedShops.isNotEmpty;
    final productsEmpty = !state.isLoading && state.items.isEmpty && state.errorMessage == null;

    if (state.isLoading && state.items.isEmpty && !hasEntityMatches) {
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

    if (state.errorMessage != null && state.items.isEmpty && !hasEntityMatches) {
      return ErrorState(
        message: state.errorMessage!,
        onRetry: () => notifier.search(reset: true),
      );
    }

    if (productsEmpty && !hasEntityMatches) {
      return EmptyState(
        title: ref.t('catalog.no_matches'),
        message: ref.t('catalog.nothing_found', {'query': state.query}),
        icon: Icons.search_off,
      );
    }

    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification.metrics.pixels >= notification.metrics.maxScrollExtent - 200 &&
            state.hasMore &&
            !state.isLoadingMore) {
          notifier.loadMore();
        }
        return false;
      },
      child: CustomScrollView(
        slivers: [
          if (matchedCategories.isNotEmpty)
            SliverToBoxAdapter(
              child: _SearchSection(
                title: ref.t('catalog.categories'),
                child: SizedBox(
                  height: 44,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: CustomerSpacing.marginMobile),
                    itemCount: matchedCategories.length,
                    separatorBuilder: (_, _) => const SizedBox(width: CustomerSpacing.sm),
                    itemBuilder: (context, index) {
                      final category = matchedCategories[index];
                      return ActionChip(
                        avatar: Icon(
                          iconForCategory(category.iconKey),
                          size: 18,
                          color: CustomerColors.onPrimaryContainer,
                        ),
                        label: Text(category.name),
                        backgroundColor: chipColorForIndex(index).withValues(alpha: 0.45),
                        side: BorderSide.none,
                        onPressed: () => context.push('/category/${category.slug}'),
                      );
                    },
                  ),
                ),
              ),
            ),
          if (matchedShops.isNotEmpty)
            SliverToBoxAdapter(
              child: _SearchSection(
                title: ref.t('shops.title'),
                child: Column(
                  children: matchedShops.map((shop) {
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: CustomerSpacing.marginMobile,
                      ),
                      leading: CircleAvatar(
                        backgroundColor: CustomerColors.surfaceContainerHigh,
                        backgroundImage:
                            shop.imageUrl != null && shop.imageUrl!.isNotEmpty
                                ? CachedNetworkImageProvider(shop.imageUrl!)
                                : null,
                        child: shop.imageUrl == null || shop.imageUrl!.isEmpty
                            ? const Icon(Icons.storefront_outlined, size: 20)
                            : null,
                      ),
                      title: Text(
                        shop.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                      subtitle: shop.city != null && shop.city!.isNotEmpty
                          ? Text(shop.city!)
                          : null,
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () => context.push('/shops/${shop.slug}'),
                    );
                  }).toList(),
                ),
              ),
            ),
          if (state.items.isNotEmpty || state.isLoading) ...[
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  CustomerSpacing.marginMobile,
                  CustomerSpacing.md,
                  CustomerSpacing.marginMobile,
                  CustomerSpacing.sm,
                ),
                child: Text(
                  ref.t('catalog.products'),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            ),
            if (state.isLoading && state.items.isEmpty)
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: CustomerSpacing.marginMobile),
                sliver: SliverGrid(
                  gridDelegate: homeSizedProductGridDelegate(context),
                  delegate: SliverChildBuilderDelegate(
                    (_, _) => const Align(
                      alignment: Alignment.topCenter,
                      child: ProductCardSkeleton(),
                    ),
                    childCount: 4,
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(
                  CustomerSpacing.marginMobile,
                  0,
                  CustomerSpacing.marginMobile,
                  100,
                ),
                sliver: SliverGrid(
                  gridDelegate: homeSizedProductGridDelegate(context),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      if (index >= state.items.length) {
                        return const Center(
                          child: CircularProgressIndicator(color: CustomerColors.primary),
                        );
                      }
                      return Align(
                        alignment: Alignment.topCenter,
                        child: CartAwareProductCard(product: state.items[index]),
                      );
                    },
                    childCount: state.items.length + (state.isLoadingMore ? 1 : 0),
                  ),
                ),
              ),
          ] else if (productsEmpty && hasEntityMatches)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
                child: Text(
                  ref.t('catalog.no_product_matches'),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: CustomerColors.onSurfaceVariant,
                      ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _IdleSearchBody extends StatelessWidget {
  const _IdleSearchBody({
    required this.recent,
    required this.categories,
    required this.topSelling,
    required this.topSellingLoading,
    required this.onRecentTap,
    required this.onCategoryTap,
  });

  final List<String> recent;
  final List<CatalogCategory> categories;
  final List<CatalogProduct> topSelling;
  final bool topSellingLoading;
  final ValueChanged<String> onRecentTap;
  final ValueChanged<String> onCategoryTap;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(
            CustomerSpacing.marginMobile,
            CustomerSpacing.sm,
            CustomerSpacing.marginMobile,
            CustomerSpacing.md,
          ),
          sliver: SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (recent.isNotEmpty) ...[
                  Text(context.t('catalog.recent'), style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: CustomerSpacing.sm),
                  Wrap(
                    spacing: CustomerSpacing.sm,
                    runSpacing: CustomerSpacing.sm,
                    children: recent.map((query) {
                      return ActionChip(
                        label: Text(query),
                        shape: StadiumBorder(
                          side: BorderSide(
                            color: CustomerColors.outlineVariant.withValues(alpha: 0.5),
                          ),
                        ),
                        onPressed: () => onRecentTap(query),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: CustomerSpacing.lg),
                ] else ...[
                  Text(
                    context.t('catalog.search_title'),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: CustomerSpacing.xs),
                  Text(
                    context.t('catalog.search_subtitle'),
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: CustomerColors.onSurfaceVariant,
                        ),
                  ),
                  const SizedBox(height: CustomerSpacing.lg),
                ],
                if (categories.isNotEmpty) ...[
                  Text(
                    context.t('catalog.popular_categories'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: CustomerSpacing.sm),
                  Wrap(
                    spacing: CustomerSpacing.sm,
                    runSpacing: CustomerSpacing.sm,
                    children: [
                      for (var i = 0; i < categories.length; i++)
                        ActionChip(
                          avatar: Icon(
                            iconForCategory(categories[i].iconKey),
                            size: 18,
                            color: CustomerColors.onPrimaryContainer,
                          ),
                          label: Text(categories[i].name),
                          backgroundColor: chipColorForIndex(i).withValues(alpha: 0.4),
                          side: BorderSide.none,
                          onPressed: () => onCategoryTap(categories[i].slug),
                        ),
                    ],
                  ),
                  const SizedBox(height: CustomerSpacing.lg),
                ],
                Text(
                  context.t('catalog.top_selling'),
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
              ],
            ),
          ),
        ),
        if (topSellingLoading && topSelling.isEmpty)
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
        const SliverToBoxAdapter(child: SizedBox(height: 100)),
      ],
    );
  }
}

class _SearchSection extends StatelessWidget {
  const _SearchSection({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: CustomerSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              CustomerSpacing.marginMobile,
              0,
              CustomerSpacing.marginMobile,
              CustomerSpacing.sm,
            ),
            child: Text(
              title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}
