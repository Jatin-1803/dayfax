import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_radius.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/price_text.dart';
import '../../../../shared/widgets/state_widgets.dart';
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

  @override
  Widget build(BuildContext context) {
    final asyncProduct = ref.watch(productDetailViewModelProvider(widget.idOrSlug));

    return Scaffold(
      appBar: AppBar(title: const Text('Product')),
      body: asyncProduct.when(
        loading: () => const LoadingState(),
        error: (error, _) => ErrorState(
          message: error is AppFailure ? error.message : 'Could not load product.',
          onRetry: () =>
              ref.read(productDetailViewModelProvider(widget.idOrSlug).notifier).load(),
        ),
        data: (product) => _buildContent(context, product),
      ),
    );
  }

  Widget _buildContent(BuildContext context, CatalogProductDetail product) {
    final selected = _resolveSelected(product);
    final imageUrl = product.imageUrl;

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              CustomerSpacing.marginMobile,
              CustomerSpacing.md,
              CustomerSpacing.marginMobile,
              CustomerSpacing.lg,
            ),
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(CustomerRadius.lg),
                child: AspectRatio(
                  aspectRatio: 16 / 11,
                  child: imageUrl == null || imageUrl.isEmpty
                      ? Container(
                          color: CustomerColors.surfaceContainer,
                          child: const Icon(Icons.image_not_supported_outlined, size: 48),
                        )
                      : CachedNetworkImage(
                          imageUrl: imageUrl,
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
              const SizedBox(height: CustomerSpacing.lg),
              Text(product.name, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: CustomerSpacing.xs),
              Text(
                [
                  if (product.brand != null && product.brand!.isNotEmpty) product.brand!,
                  product.categoryName,
                ].where((v) => v.isNotEmpty).join(' · '),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: CustomerColors.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: CustomerSpacing.md),
              if (selected != null)
                PriceText(
                  paise: selected.pricePaise,
                  mrpPaise: selected.mrpPaise,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        color: CustomerColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              if (product.description != null && product.description!.isNotEmpty) ...[
                const SizedBox(height: CustomerSpacing.lg),
                Text('About', style: Theme.of(context).textTheme.titleMedium),
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
                Text('Choose size', style: Theme.of(context).textTheme.titleMedium),
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
                      ? '${selected.quantityAvailable} in stock'
                      : 'Out of stock',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: selected.inStock
                            ? CustomerColors.onSurfaceVariant
                            : CustomerColors.error,
                      ),
                ),
              ],
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
            child: AppButton(
              label: selected?.inStock == true ? 'Add to cart' : 'Out of stock',
              onPressed: selected?.inStock == true
                  ? () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Cart lands in Phase 3.'),
                        ),
                      );
                    }
                  : null,
            ),
          ),
        ),
      ],
    );
  }

  ProductVariantDetail? _resolveSelected(CatalogProductDetail product) {
    if (product.variants.isEmpty) return null;
    final match = product.variants.where((v) => v.id == _selectedVariantId);
    if (match.isNotEmpty) return match.first;
    return product.defaultVariant;
  }
}
