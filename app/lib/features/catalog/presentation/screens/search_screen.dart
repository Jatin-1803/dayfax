import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/app_search_bar.dart';
import '../../../../shared/widgets/product_card.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../catalog_view_models.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(searchViewModelProvider);
    final notifier = ref.read(searchViewModelProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Search'),
      ),
      body: Column(
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
              onChanged: notifier.onQueryChanged,
              onSubmitted: (value) {
                notifier.onQueryChanged(value);
                notifier.search(reset: true);
              },
            ),
          ),
          Expanded(child: _buildResults(context, state, notifier)),
        ],
      ),
    );
  }

  Widget _buildResults(
    BuildContext context,
    ProductListState state,
    SearchViewModel notifier,
  ) {
    if (state.query.isEmpty) {
      return const EmptyState(
        title: 'Search Dailyfax',
        message: 'Find milk, vegetables, groceries, and more.',
        icon: Icons.search,
      );
    }
    if (state.isLoading && state.items.isEmpty) {
      return const LoadingState(message: 'Searching…');
    }
    if (state.errorMessage != null && state.items.isEmpty) {
      return ErrorState(
        message: state.errorMessage!,
        onRetry: () => notifier.search(reset: true),
      );
    }
    if (!state.isLoading && state.items.isEmpty) {
      return EmptyState(
        title: 'No matches',
        message: 'Nothing found for “${state.query}”. Try another word.',
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
            return const Center(
              child: CircularProgressIndicator(color: CustomerColors.primary),
            );
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
    );
  }
}
