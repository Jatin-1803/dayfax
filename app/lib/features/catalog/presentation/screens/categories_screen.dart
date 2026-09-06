import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../domain/catalog_models.dart';
import '../catalog_view_models.dart';
import '../widgets/category_icon.dart';

class CategoriesScreen extends ConsumerWidget {
  const CategoriesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncCategories = ref.watch(categoriesListViewModelProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Categories')),
      body: asyncCategories.when(
        loading: () => const LoadingState(message: 'Loading categories…'),
        error: (error, _) => ErrorState(
          message: error is AppFailure ? error.message : 'Could not load categories.',
          onRetry: () => ref.read(categoriesListViewModelProvider.notifier).load(),
        ),
        data: (categories) {
          if (categories.isEmpty) {
            return const EmptyState(
              title: 'No categories yet',
              message: 'Check back soon for Food, Grocery, and Vegetables.',
            );
          }
          return GridView.builder(
            padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: CustomerSpacing.md,
              crossAxisSpacing: CustomerSpacing.md,
              childAspectRatio: 1.15,
            ),
            itemCount: categories.length,
            itemBuilder: (context, index) {
              final category = categories[index];
              return _CategoryTile(
                category: category,
                onTap: () => context.push('/category/${category.slug}'),
              );
            },
          );
        },
      ),
    );
  }
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({required this.category, required this.onTap});

  final CatalogCategory category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: CustomerColors.surfaceContainerLowest,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(CustomerSpacing.lg),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: CustomerColors.primaryContainer,
                child: Icon(
                  iconForCategory(category.iconKey),
                  color: CustomerColors.onPrimaryContainer,
                ),
              ),
              const SizedBox(height: CustomerSpacing.md),
              Text(
                category.name,
                style: Theme.of(context).textTheme.titleMedium,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
