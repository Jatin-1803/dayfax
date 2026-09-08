import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_radius.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../shops_view_models.dart';

class ShopsListScreen extends ConsumerWidget {
  const ShopsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(popularShopsViewModelProvider);

    return Scaffold(
      appBar: AppBar(title: Text(context.t('shops.title'))),
      body: RefreshIndicator(
        color: CustomerColors.primary,
        onRefresh: () => ref.read(popularShopsViewModelProvider.notifier).load(),
        child: _body(context, ref, state),
      ),
    );
  }

  Widget _body(BuildContext context, WidgetRef ref, PopularShopsState state) {
    if (state.isLoading && state.shops.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
        children: const [
          SkeletonBox(height: 88, borderRadius: 16),
          SizedBox(height: CustomerSpacing.md),
          SkeletonBox(height: 88, borderRadius: 16),
          SizedBox(height: CustomerSpacing.md),
          SkeletonBox(height: 88, borderRadius: 16),
        ],
      );
    }
    if (state.errorMessage != null && state.shops.isEmpty) {
      return ErrorState(
        message: state.errorMessage!,
        onRetry: () => ref.read(popularShopsViewModelProvider.notifier).load(),
      );
    }
    if (state.shops.isEmpty) {
      return EmptyState(
        title: context.t('shops.empty_title'),
        message: context.t('shops.empty_message'),
        icon: Icons.storefront_outlined,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
      itemCount: state.shops.length,
      separatorBuilder: (_, _) => const SizedBox(height: CustomerSpacing.md),
      itemBuilder: (context, index) {
        final shop = state.shops[index];
        return Material(
          color: CustomerColors.surfaceContainerLowest,
          borderRadius: BorderRadius.circular(CustomerRadius.lg),
          child: InkWell(
            onTap: () => context.push('/shops/${shop.slug}'),
            borderRadius: BorderRadius.circular(CustomerRadius.lg),
            child: Padding(
              padding: const EdgeInsets.all(CustomerSpacing.md),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(CustomerRadius.full),
                    child: shop.imageUrl == null || shop.imageUrl!.isEmpty
                        ? Container(
                            width: 56,
                            height: 56,
                            color: CustomerColors.primaryContainer,
                            child: const Icon(Icons.storefront, color: CustomerColors.primary),
                          )
                        : CachedNetworkImage(
                            imageUrl: shop.imageUrl!,
                            width: 56,
                            height: 56,
                            fit: BoxFit.cover,
                            memCacheWidth: 112,
                            errorWidget: (_, _, _) => Container(
                              width: 56,
                              height: 56,
                              color: CustomerColors.primaryContainer,
                              child: const Icon(Icons.storefront, color: CustomerColors.primary),
                            ),
                          ),
                  ),
                  const SizedBox(width: CustomerSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(shop.name, style: Theme.of(context).textTheme.titleMedium),
                        if (shop.addressSummary != null && shop.addressSummary!.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            shop.addressSummary!,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: CustomerColors.onSurfaceVariant,
                                ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
