import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_radius.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/app_search_bar.dart';
import '../../../../shared/widgets/product_card.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../../../shared/widgets/sticky_cart_bar.dart';
import '../../../cart/presentation/widgets/cart_aware_product_card.dart';
import '../shops_view_models.dart';

class ShopDetailScreen extends ConsumerStatefulWidget {
  const ShopDetailScreen({super.key, required this.idOrSlug});

  final String idOrSlug;

  @override
  ConsumerState<ShopDetailScreen> createState() => _ShopDetailScreenState();
}

class _ShopDetailScreenState extends ConsumerState<ShopDetailScreen> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(shopDetailViewModelProvider(widget.idOrSlug));
    final notifier = ref.read(shopDetailViewModelProvider(widget.idOrSlug).notifier);

    return Scaffold(
      appBar: AppBar(title: Text(state.shop?.name ?? context.t('shops.title'))),
      body: StickyCartScaffoldBody(
        child: _body(context, state, notifier),
      ),
    );
  }

  Widget _body(
    BuildContext context,
    ShopDetailState state,
    ShopDetailViewModel notifier,
  ) {
    if (state.isLoading && state.shop == null) {
      return const Padding(
        padding: EdgeInsets.all(CustomerSpacing.marginMobile),
        child: Column(
          children: [
            SkeletonBox(height: 96, borderRadius: 16),
            SizedBox(height: CustomerSpacing.lg),
            Expanded(child: ProductCardSkeleton(width: double.infinity)),
          ],
        ),
      );
    }
    if (state.errorMessage != null && state.shop == null) {
      return ErrorState(
        message: state.errorMessage!,
        onRetry: () => notifier.load(reset: true),
      );
    }

    final shop = state.shop!;
    final hasQuery = state.query.trim().isNotEmpty;
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
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  CustomerSpacing.marginMobile,
                  CustomerSpacing.md,
                  CustomerSpacing.marginMobile,
                  CustomerSpacing.sm,
                ),
                child: Material(
                  color: CustomerColors.surfaceContainerLowest,
                  borderRadius: BorderRadius.circular(CustomerRadius.lg),
                  child: Padding(
                    padding: const EdgeInsets.all(CustomerSpacing.md),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(CustomerRadius.full),
                          child: shop.imageUrl == null || shop.imageUrl!.isEmpty
                              ? Container(
                                  width: 72,
                                  height: 72,
                                  color: CustomerColors.primaryContainer,
                                  child: const Icon(
                                    Icons.storefront,
                                    color: CustomerColors.primary,
                                    size: 32,
                                  ),
                                )
                              : CachedNetworkImage(
                                  imageUrl: shop.imageUrl!,
                                  width: 72,
                                  height: 72,
                                  fit: BoxFit.cover,
                                  memCacheWidth: 144,
                                  errorWidget: (_, _, _) => Container(
                                    width: 72,
                                    height: 72,
                                    color: CustomerColors.primaryContainer,
                                    child: const Icon(
                                      Icons.storefront,
                                      color: CustomerColors.primary,
                                      size: 32,
                                    ),
                                  ),
                                ),
                        ),
                        const SizedBox(width: CustomerSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(shop.name, style: Theme.of(context).textTheme.titleLarge),
                              if (shop.addressSummary != null &&
                                  shop.addressSummary!.isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Text(
                                  shop.addressSummary!,
                                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                        color: CustomerColors.onSurfaceVariant,
                                      ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
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
                      context.t('shops.menu'),
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: CustomerSpacing.sm),
                    AppSearchBar(
                      controller: _searchController,
                      hintText: context.t('shops.search_menu_hint'),
                      onChanged: notifier.onQueryChanged,
                    ),
                  ],
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
                    childCount: 6,
                  ),
                ),
              )
            else if (state.items.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: EmptyState(
                  title: hasQuery
                      ? context.t('shops.no_menu_matches')
                      : context.t('shops.no_items'),
                  message: hasQuery
                      ? context.t('catalog.nothing_found', {'query': state.query})
                      : context.t('shops.empty_message'),
                  icon: hasQuery ? Icons.search_off : Icons.restaurant_menu_outlined,
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
                        return const Center(child: CircularProgressIndicator());
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
          ],
        ),
      ),
    );
  }
}
