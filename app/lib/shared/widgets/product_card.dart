import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/theme/customer/customer_colors.dart';
import '../../core/theme/customer/customer_radius.dart';
import '../../core/theme/customer/customer_shadows.dart';
import '../../core/theme/customer/customer_spacing.dart';
import 'price_text.dart';

class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.name,
    required this.subtitle,
    required this.pricePaise,
    required this.imageUrl,
    required this.onAdd,
    this.onTap,
    this.width = 160,
  });

  final String name;
  final String subtitle;
  final int pricePaise;
  final String imageUrl;
  final VoidCallback onAdd;
  final VoidCallback? onTap;
  final double width;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(CustomerRadius.lg),
      child: Container(
        width: width,
        padding: const EdgeInsets.all(CustomerSpacing.sm),
        decoration: BoxDecoration(
          color: CustomerColors.surfaceContainerLowest,
          borderRadius: BorderRadius.circular(CustomerRadius.lg),
          boxShadow: CustomerShadows.level1,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(CustomerRadius.md),
              child: AspectRatio(
                aspectRatio: 16 / 10,
                child: imageUrl.isEmpty
                    ? Container(
                        color: CustomerColors.surfaceContainer,
                        child: const Icon(Icons.image_not_supported_outlined),
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
            const SizedBox(height: CustomerSpacing.sm),
            Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelLarge,
            ),
            Text(
              subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: CustomerColors.onSurfaceVariant,
                    fontSize: 12,
                  ),
            ),
            const Spacer(),
            Row(
              children: [
                Expanded(child: PriceText(paise: pricePaise)),
                Material(
                  color: CustomerColors.primaryContainer,
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: onAdd,
                    child: const SizedBox(
                      width: 32,
                      height: 32,
                      child: Icon(Icons.add, size: 18, color: CustomerColors.onPrimaryContainer),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
