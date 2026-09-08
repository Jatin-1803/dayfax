import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_radius.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/scale_on_tap.dart';
import 'category_icon.dart';

/// Zepto-style category tile used on Categories tab and Home.
class CategoryTile extends StatelessWidget {
  const CategoryTile({
    super.key,
    required this.label,
    required this.iconKey,
    required this.color,
    required this.onTap,
    this.imageUrl,
    this.compact = false,
  });

  final String label;
  final String? iconKey;
  final String? imageUrl;
  final Color color;
  final VoidCallback onTap;

  /// Home 4-col strip uses compact; Categories 3-col uses full.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final iconSize = compact ? 26.0 : 32.0;
    final labelStyle = compact
        ? Theme.of(context).textTheme.labelSmall?.copyWith(
              color: CustomerColors.onSurface,
              fontWeight: FontWeight.w600,
              height: 1.15,
            )
        : Theme.of(context).textTheme.labelMedium?.copyWith(
              color: CustomerColors.onSurface,
              fontWeight: FontWeight.w700,
              height: 1.15,
            );

    final textScale = MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 1.4);
    final labelHeight = (compact ? 28.0 : 32.0) * textScale;

    return ScaleOnTap(
      onTap: onTap,
      child: Column(
        children: [
          Expanded(
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(CustomerRadius.md),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    color.withValues(alpha: 0.72),
                    color.withValues(alpha: 0.28),
                    CustomerColors.surfaceContainerLowest,
                  ],
                  stops: const [0.0, 0.55, 1.0],
                ),
                border: Border.all(
                  color: color.withValues(alpha: 0.35),
                ),
              ),
              child: Center(
                child: Container(
                  width: compact ? 44 : 56,
                  height: compact ? 44 : 56,
                  decoration: BoxDecoration(
                    color: CustomerColors.surfaceContainerLowest.withValues(alpha: 0.92),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.06),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: ClipOval(
                    child: _CategoryMedia(
                      imageUrl: imageUrl,
                      iconKey: iconKey,
                      iconSize: iconSize,
                    ),
                  ),
                ),
              ),
            ),
          ),
          SizedBox(height: compact ? CustomerSpacing.xs : CustomerSpacing.sm - 2),
          SizedBox(
            height: labelHeight,
            width: double.infinity,
            child: Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: labelStyle,
            ),
          ),
        ],
      ),
    );
  }
}

class CategoryCircleChip extends StatelessWidget {
  const CategoryCircleChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.iconKey,
    this.imageUrl,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final String? iconKey;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final ring = selected ? CustomerColors.primary : CustomerColors.outlineVariant;
    return ScaleOnTap(
      onTap: onTap,
      child: SizedBox(
        width: 76,
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: ring, width: selected ? 2.5 : 1),
                color: selected
                    ? CustomerColors.primaryContainer
                    : CustomerColors.surfaceContainerLowest,
              ),
              child: ClipOval(
                child: ColoredBox(
                  color: CustomerColors.surfaceContainerLow,
                  child: _CategoryMedia(
                    imageUrl: imageUrl,
                    iconKey: iconKey,
                    iconSize: 26,
                  ),
                ),
              ),
            ),
            const SizedBox(height: CustomerSpacing.xs),
            Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                    color: selected ? CustomerColors.primary : CustomerColors.onSurface,
                    height: 1.15,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CategoryMedia extends StatelessWidget {
  const _CategoryMedia({
    required this.imageUrl,
    required this.iconKey,
    required this.iconSize,
  });

  final String? imageUrl;
  final String? iconKey;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    final url = imageUrl?.trim() ?? '';
    if (url.isEmpty) {
      return Center(
        child: Icon(
          iconForCategory(iconKey),
          color: CustomerColors.onPrimaryContainer,
          size: iconSize,
        ),
      );
    }
    return CachedNetworkImage(
      imageUrl: url,
      fit: BoxFit.cover,
      width: double.infinity,
      height: double.infinity,
      placeholder: (context, _) => Icon(
        iconForCategory(iconKey),
        color: CustomerColors.onPrimaryContainer,
        size: iconSize,
      ),
      errorWidget: (context, _, _) => Icon(
        iconForCategory(iconKey),
        color: CustomerColors.onPrimaryContainer,
        size: iconSize,
      ),
    );
  }
}
