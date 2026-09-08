import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../core/theme/customer/customer_colors.dart';
import '../../core/theme/customer/customer_radius.dart';
import '../../core/theme/customer/customer_spacing.dart';
import 'price_text.dart';
import 'qty_stepper.dart';

/// Default width for horizontal product rails (Zepto-density).
const double kProductCardRailWidth = 124;

/// Metadata block under the square image at text scale 1 (name, unit, price).
const double kProductCardMetaHeight = 88;

/// Fallback rail height at text scale 1. Prefer [productCardRailHeight].
const double kProductCardRailHeight = kProductCardRailWidth + kProductCardMetaHeight;

/// Grid cell aspect ratio for legacy 2-column product grids.
const double kProductGridAspectRatio = 0.74;

/// Max cell width so grids lay out at home-rail card size (~2–3 cols).
const double kProductGridMaxCrossAxisExtent = kProductCardRailWidth + 16;

/// Rail/grid height that grows with the system text scale so cards never
/// overflow on small phones, large fonts, or Hindi glyphs.
double productCardRailHeight(
  BuildContext context, {
  double width = kProductCardRailWidth,
}) {
  final textScale = MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 1.6);
  return width + kProductCardMetaHeight * textScale;
}

/// Shared grid delegate matching home product-card dimensions.
SliverGridDelegate homeSizedProductGridDelegate(BuildContext context) {
  return SliverGridDelegateWithMaxCrossAxisExtent(
    maxCrossAxisExtent: kProductGridMaxCrossAxisExtent,
    mainAxisExtent: productCardRailHeight(context),
    mainAxisSpacing: 8,
    crossAxisSpacing: 8,
  );
}

/// Horizontal product rail. Padding is horizontal only — vertical padding
/// would shrink the card's cross-axis and overflow the bottom.
class ProductCardRail extends StatelessWidget {
  const ProductCardRail({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
    this.padding,
  });

  final int itemCount;
  final IndexedWidgetBuilder itemBuilder;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: productCardRailHeight(context),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: padding ??
            const EdgeInsets.symmetric(horizontal: CustomerSpacing.marginMobile),
        itemCount: itemCount,
        separatorBuilder: (_, _) => const SizedBox(width: CustomerSpacing.sm),
        itemBuilder: itemBuilder,
      ),
    );
  }
}

class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.name,
    required this.subtitle,
    required this.pricePaise,
    required this.imageUrl,
    required this.onAdd,
    this.onTap,
    this.width = kProductCardRailWidth,
    this.mrpPaise,
    this.discountPercent = 0,
    this.quantity = 0,
    this.onIncrement,
    this.onDecrement,
    this.enabled = true,
  });

  final String name;
  final String subtitle;
  final int pricePaise;
  final String imageUrl;
  final VoidCallback onAdd;
  final VoidCallback? onTap;
  final double width;
  final int? mrpPaise;
  final int discountPercent;
  final int quantity;
  final VoidCallback? onIncrement;
  final VoidCallback? onDecrement;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final radius = CustomerRadius.md;
    final desiredHeight = productCardRailHeight(context, width: width);

    return LayoutBuilder(
      builder: (context, constraints) {
        final height = constraints.maxHeight.isFinite && constraints.maxHeight < desiredHeight
            ? constraints.maxHeight
            : desiredHeight;
        final cardWidth = width.isFinite
            ? width
            : (constraints.maxWidth.isFinite ? constraints.maxWidth : kProductCardRailWidth);
        final imageHeight = (height - 72).clamp(48.0, cardWidth);

        return SizedBox(
      width: width.isFinite ? width : null,
      height: height,
      child: Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(radius),
        child: Ink(
          decoration: BoxDecoration(
            color: CustomerColors.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(
              color: CustomerColors.outlineVariant.withValues(alpha: 0.28),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 10,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.vertical(
                      top: Radius.circular(radius - 1),
                    ),
                    child: SizedBox(
                      height: imageHeight,
                      width: double.infinity,
                      child: ColoredBox(
                        color: CustomerColors.surfaceContainerLow,
                        child: imageUrl.isEmpty
                            ? const Icon(
                                Icons.image_not_supported_outlined,
                                color: CustomerColors.outline,
                                size: 28,
                              )
                            : CachedNetworkImage(
                                imageUrl: imageUrl,
                                fit: BoxFit.cover,
                                placeholder: (context, url) =>
                                    const ColoredBox(color: CustomerColors.surfaceContainerLow),
                                errorWidget: (context, url, error) => const Icon(
                                  Icons.image_not_supported_outlined,
                                  color: CustomerColors.outline,
                                  size: 28,
                                ),
                              ),
                      ),
                    ),
                  ),
                  if (discountPercent > 0)
                    Positioned(
                      top: CustomerSpacing.xs,
                      left: CustomerSpacing.xs,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 5,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: CustomerColors.tertiary,
                          borderRadius: BorderRadius.circular(CustomerRadius.full),
                        ),
                        child: Text(
                          '$discountPercent% OFF',
                          style: textTheme.labelSmall?.copyWith(
                            color: CustomerColors.onTertiary,
                            fontWeight: FontWeight.w800,
                            fontSize: 9,
                            height: 1.1,
                          ),
                        ),
                      ),
                    ),
                  Positioned(
                    right: CustomerSpacing.xs,
                    bottom: CustomerSpacing.xs,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(CustomerRadius.full),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.08),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: AddOrStepper(
                        quantity: quantity,
                        onAdd: onAdd,
                        onIncrement: onIncrement ?? onAdd,
                        onDecrement: onDecrement ?? () {},
                        enabled: enabled,
                        compact: true,
                      ),
                    ),
                  ),
                ],
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(6, 6, 6, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          fontSize: 12.5,
                          height: 1.2,
                          color: CustomerColors.onSurface,
                        ),
                      ),
                      if (subtitle.isNotEmpty) ...[
                        const SizedBox(height: 1),
                        Text(
                          subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: textTheme.bodySmall?.copyWith(
                            color: CustomerColors.onSurfaceVariant,
                            fontSize: 10,
                            height: 1.2,
                          ),
                        ),
                      ],
                      const Spacer(),
                      PriceText(
                        paise: pricePaise,
                        mrpPaise: mrpPaise,
                        style: textTheme.titleSmall?.copyWith(
                          color: CustomerColors.primary,
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                          height: 1.15,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
        );
      },
    );
  }
}
