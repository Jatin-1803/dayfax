import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/product_card.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../catalog_view_models.dart';

class CategoryProductsScreen extends ConsumerWidget {
  const CategoryProductsScreen({super.key, required this.categorySlug});

  final String categorySlug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(categoryProductsViewModelProvider(categorySlug));
    final notifier = ref.read(categoryProductsViewModelProvider(categorySlug).notifier);

    return Scaffold(
      appBar: AppBar(
        title: Text(state.title ?? 'Category'),
      ),
      body: _buildBody(context, state, notifier),
    );
  }

  Widget _buildBody(
    BuildContext context,
    ProductListState state,
    CategoryProductsViewModel notifier,
  ) {
    if (state.isLoading && state.items.isEmpty) {
      return const LoadingState(message: 'Loading products…');
    }
    if (state.errorMessage != null && state.items.isEmpty) {
      return ErrorState(
        message: state.errorMessage!,
        onRetry: () => notifier.load(reset: true),
      );
    }
    if (state.items.isEmpty) {
      return const EmptyState(
        title: 'No products here',
        message: 'Try another category or search for something else.',
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
          padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: CustomerSpacing.md,
            crossAxisSpacing: CustomerSpacing.md,
            childAspectRatio: 0.72,
          ),
          itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
          itemBuilder: (context, index) {
            if (index >= state.items.length) {
              return const Center(child: CircularProgressIndicator());
            }
            final product = state.items[index];
            return ProductCard(
              name: product.name,
              subtitle: product.storeName.isEmpty ? product.categoryName : product.storeName,
              pricePaise: product.pricePaise,
              imageUrl: product.imageUrl ?? '',
              width: double.infinity,
              onAdd: () {},
              onTap: () => context.push('/products/${product.slug}'),
            );
          },
        ),
      ),
    );
  }
}
