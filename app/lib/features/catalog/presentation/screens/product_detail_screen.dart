import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_radius.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/eta_banner.dart';
import '../../../../shared/widgets/price_text.dart';
import '../../../../shared/widgets/product_card.dart';
import '../../../../shared/widgets/qty_stepper.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../../../shared/widgets/sticky_cart_bar.dart';
import '../../../cart/presentation/cart_actions.dart';
import '../../../cart/presentation/cart_view_model.dart';
import '../../../cart/presentation/widgets/cart_aware_product_card.dart';
import '../../../orders/domain/delivery_quote.dart';
import '../../domain/catalog_models.dart';
import '../catalog_view_models.dart';

class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({super.key, required this.idOrSlug});

  final String idOrSlug;

  @override
  ConsumerState<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  String? _selectedVariantId;
  bool _adding = false;

  @override
  Widget build(BuildContext context) {
    final asyncProduct = ref.watch(productDetailViewModelProvider(widget.idOrSlug));
    final quoteAsync = ref.watch(deliveryQuoteProvider(null));

    return asyncProduct.when(
      loading: () => Scaffold(
        appBar: AppBar(title: Text(ref.t('catalog.product'))),
        body: const ProductDetailSkeleton(),
      ),
      error: (error, _) => Scaffold(
        appBar: AppBar(title: Text(ref.t('catalog.product'))),
        body: ErrorState(
          message: error is AppFailure ? error.message : 'catalog.could_not_load_product',
          onRetry: () =>
              ref.read(productDetailViewModelProvider(widget.idOrSlug).notifier).load(),
        ),
      ),
      data: (product) {
        final selected = _resolveSelected(product);
        final quantity = selected == null
            ? 0
            : ref.watch(cartQuantityByVariantProvider(selected.id));
        final itemId = selected == null
            ? null
            : ref.watch(cartItemIdByVariantProvider(selected.id));
        final eta = quoteAsync.maybeWhen(data: (q) => q.etaMinutes, orElse: () => null);

        return Scaffold(
          appBar: AppBar(title: Text(product.name)),
          body: StickyCartScaffoldBody(
            child: Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(
                      CustomerSpacing.marginMobile,
                      CustomerSpacing.md,
                      CustomerSpacing.marginMobile,
                      100,
                    ),
                    children: [
                      if (eta != null && eta > 0) ...[
                        EtaBanner(etaMinutes: eta),
                        const SizedBox(height: CustomerSpacing.md),
                      ],
                      Hero(
                        tag: 'product-image-${product.id}',
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(CustomerRadius.lg),
                          child: AspectRatio(
                            aspectRatio: 16 / 11,
                            child: product.imageUrl == null || product.imageUrl!.isEmpty
                                ? Container(
                                    color: CustomerColors.surfaceContainer,
                                    child: const Icon(
                                      Icons.image_not_supported_outlined,
                                      size: 48,
                                    ),
                                  )
                                : CachedNetworkImage(
                                    imageUrl: product.imageUrl!,
                                    fit: BoxFit.cover,
                                    placeholder: (context, url) =>
                                        Container(color: CustomerColors.surfaceContainer),
                                    errorWidget: (context, url, error) => Container(
                                      color: CustomerColors.surfaceContainer,
                                      child: const Icon(Icons.image_not_supported_outlined),
                                    ),
                                  ),
                          ),
                        ),
                      ),
                      const SizedBox(height: CustomerSpacing.lg),
                      Text(product.name, style: Theme.of(context).textTheme.headlineSmall),
                      const SizedBox(height: CustomerSpacing.xs),
                      Text(
                        [
                          if (product.brand != null && product.brand!.isNotEmpty) product.brand!,
                          if (product.subCategory != null && product.subCategory!.isNotEmpty)
                            product.subCategory!,
                          product.categoryName,
                        ].where((v) => v.isNotEmpty).join(' · '),
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: CustomerColors.onSurfaceVariant,
                            ),
                      ),
                      const SizedBox(height: CustomerSpacing.md),
                      if (selected != null) ...[
                        Row(
                          children: [
                            Expanded(
                              child: PriceText(
                                paise: selected.pricePaise,
                                mrpPaise: selected.mrpPaise,
                                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                      color: CustomerColors.primary,
                                      fontWeight: FontWeight.w700,
                                    ),
                              ),
                            ),
                            if (selected.discountPercent > 0)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: CustomerSpacing.sm,
                                  vertical: CustomerSpacing.xs,
                                ),
                                decoration: BoxDecoration(
                                  color: CustomerColors.tertiaryContainer,
                                  borderRadius: BorderRadius.circular(CustomerRadius.full),
                                ),
                                child: Text(
                                  ref.t('catalog.percent_off', {'percent': '${selected.discountPercent}'}),
                                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                                        color: CustomerColors.onTertiaryContainer,
                                        fontWeight: FontWeight.w800,
                                      ),
                                ),
                              ),
                          ],
                        ),
                      ],
                      if (product.description != null && product.description!.isNotEmpty) ...[
                        const SizedBox(height: CustomerSpacing.lg),
                        Text(ref.t('catalog.about'), style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: CustomerSpacing.sm),
                        Text(
                          product.description!,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: CustomerColors.onSurfaceVariant,
                              ),
                        ),
                      ],
                      if (product.variants.isNotEmpty) ...[
                        const SizedBox(height: CustomerSpacing.lg),
                        Text(ref.t('catalog.choose_size'), style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: CustomerSpacing.sm),
                        Wrap(
                          spacing: CustomerSpacing.sm,
                          runSpacing: CustomerSpacing.sm,
                          children: product.variants.map((variant) {
                            final isSelected = variant.id == selected?.id;
                            return ChoiceChip(
                              label: Text(variant.unitLabel),
                              selected: isSelected,
                              onSelected: variant.inStock
                                  ? (_) => setState(() => _selectedVariantId = variant.id)
                                  : null,
                              selectedColor: CustomerColors.primaryContainer,
                              labelStyle: TextStyle(
                                color: isSelected
                                    ? CustomerColors.onPrimaryContainer
                                    : CustomerColors.onSurface,
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                      if (selected != null) ...[
                        const SizedBox(height: CustomerSpacing.md),
                        Text(
                          selected.inStock
                              ? ref.t('catalog.in_stock', {'count': '${selected.quantityAvailable}'})
                              : ref.t('catalog.out_of_stock'),
                          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                                color: selected.inStock
                                    ? CustomerColors.onSurfaceVariant
                                    : CustomerColors.error,
                              ),
                        ),
                      ],
                      _SimilarProductsSection(
                        idOrSlug: widget.idOrSlug,
                        categorySlug: product.categorySlug,
                      ),
                    ],
                  ),
                ),
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      CustomerSpacing.marginMobile,
                      CustomerSpacing.sm,
                      CustomerSpacing.marginMobile,
                      CustomerSpacing.md,
                    ),
                    child: Row(
                      children: [
                        if (selected != null)
                          Expanded(
                            child: PriceText(
                              paise: selected.pricePaise,
                              mrpPaise: selected.mrpPaise,
                              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                    color: CustomerColors.primary,
                                    fontWeight: FontWeight.w800,
                                  ),
                            ),
                          ),
                        if (quantity > 0 && itemId != null)
                          QtyStepper(
                            quantity: quantity,
                            onIncrement: () => ref
                                .read(cartViewModelProvider.notifier)
                                .setQuantity(itemId, quantity + 1),
                            onDecrement: () => ref
                                .read(cartViewModelProvider.notifier)
                                .setQuantity(itemId, quantity - 1),
                          )
                        else
                          Flexible(
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 220),
                              child: AppButton(
                              label: selected?.inStock == true ? ref.t('catalog.add') : ref.t('catalog.out_of_stock'),
                              isLoading: _adding,
                              expanded: true,
                              onPressed: selected?.inStock == true && !_adding
                                  ? () async {
                                      setState(() => _adding = true);
                                      try {
                                        await addVariantToCart(
                                          context,
                                          ref,
                                          variantId: selected!.id,
                                        );
                                      } finally {
                                        if (mounted) setState(() => _adding = false);
                                      }
                                    }
                                  : null,
                            ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  ProductVariantDetail? _resolveSelected(CatalogProductDetail product) {
    if (product.variants.isEmpty) return null;
    final match = product.variants.where((v) => v.id == _selectedVariantId);
    if (match.isNotEmpty) return match.first;
    return product.defaultVariant;
  }
}

class _SimilarProductsSection extends ConsumerWidget {
  const _SimilarProductsSection({
    required this.idOrSlug,
    this.categorySlug,
  });

  final String idOrSlug;
  final String? categorySlug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncSimilar = ref.watch(similarProductsViewModelProvider(idOrSlug));

    return asyncSimilar.when(
      loading: () => Padding(
        padding: const EdgeInsets.only(top: CustomerSpacing.xl),
        child: ProductCardRail(
          itemCount: 3,
          padding: EdgeInsets.zero,
          itemBuilder: (_, _) => const ProductCardSkeleton(),
        ),
      ),
      error: (_, _) => const SizedBox.shrink(),
      data: (products) {
        if (products.isEmpty) return const SizedBox.shrink();

        final slug = categorySlug;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: CustomerSpacing.xl),
            Row(
              children: [
                Expanded(
                  child: Text(
                    ref.t('catalog.similar'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                if (slug != null && slug.isNotEmpty)
                  TextButton(
                    onPressed: () => context.push('/category/$slug'),
                    child: Text(ref.t('common.see_all')),
                  ),
              ],
            ),
            const SizedBox(height: CustomerSpacing.md),
            ProductCardRail(
              itemCount: products.length,
              padding: EdgeInsets.zero,
              itemBuilder: (context, index) {
                return CartAwareProductCard(product: products[index]);
              },
            ),
          ],
        );
      },
    );
  }
}
