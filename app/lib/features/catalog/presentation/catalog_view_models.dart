import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../data/catalog_repository.dart';
import '../domain/catalog_models.dart';

sealed class CatalogUiState {
  const CatalogUiState();
}

class CatalogLoading extends CatalogUiState {
  const CatalogLoading();
}

class CatalogReady extends CatalogUiState {
  const CatalogReady({
    required this.categories,
    required this.products,
  });

  final List<CatalogCategory> categories;
  final List<CatalogProduct> products;
}

class CatalogError extends CatalogUiState {
  const CatalogError(this.message);

  final String message;
}

class HomeCatalogViewModel extends Notifier<CatalogUiState> {
  @override
  CatalogUiState build() {
    Future.microtask(load);
    return const CatalogLoading();
  }

  CatalogRepository get _repo => ref.read(catalogRepositoryProvider);

  Future<void> load() async {
    state = const CatalogLoading();
    try {
      final categories = await _repo.listCategories();
      final page = await _repo.listProducts(page: 1, limit: 12);
      state = CatalogReady(
        categories: categories,
        products: page.items,
      );
    } on AppFailure catch (failure) {
      state = CatalogError(failure.message);
    }
  }
}

final homeCatalogViewModelProvider =
    NotifierProvider<HomeCatalogViewModel, CatalogUiState>(HomeCatalogViewModel.new);

class CategoriesListViewModel extends Notifier<AsyncValue<List<CatalogCategory>>> {
  @override
  AsyncValue<List<CatalogCategory>> build() {
    Future.microtask(load);
    return const AsyncValue.loading();
  }

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final categories = await ref.read(catalogRepositoryProvider).listCategories();
      state = AsyncValue.data(categories);
    } on AppFailure catch (failure) {
      state = AsyncValue.error(failure, StackTrace.current);
    }
  }
}

final categoriesListViewModelProvider =
    NotifierProvider<CategoriesListViewModel, AsyncValue<List<CatalogCategory>>>(
  CategoriesListViewModel.new,
);

class ProductListState {
  const ProductListState({
    this.items = const [],
    this.pagination,
    this.isLoading = false,
    this.isLoadingMore = false,
    this.errorMessage,
    this.query = '',
    this.categorySlug,
    this.title,
  });

  final List<CatalogProduct> items;
  final PaginationMeta? pagination;
  final bool isLoading;
  final bool isLoadingMore;
  final String? errorMessage;
  final String query;
  final String? categorySlug;
  final String? title;

  bool get hasMore => pagination?.hasNextPage ?? false;

  ProductListState copyWith({
    List<CatalogProduct>? items,
    PaginationMeta? pagination,
    bool? isLoading,
    bool? isLoadingMore,
    String? errorMessage,
    bool clearError = false,
    String? query,
    String? categorySlug,
    String? title,
  }) {
    return ProductListState(
      items: items ?? this.items,
      pagination: pagination ?? this.pagination,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      query: query ?? this.query,
      categorySlug: categorySlug ?? this.categorySlug,
      title: title ?? this.title,
    );
  }
}

class CategoryProductsViewModel extends FamilyNotifier<ProductListState, String> {
  @override
  ProductListState build(String arg) {
    Future.microtask(() => load(reset: true));
    return ProductListState(categorySlug: arg, isLoading: true);
  }

  Future<void> load({bool reset = false}) async {
    final slug = arg;
    final nextPage = reset ? 1 : (state.pagination?.page ?? 0) + 1;
    if (!reset && !state.hasMore) return;

    state = state.copyWith(
      isLoading: reset,
      isLoadingMore: !reset,
      clearError: true,
    );

    try {
      final category = await ref.read(catalogRepositoryProvider).getCategory(slug);
      final page = await ref.read(catalogRepositoryProvider).listProducts(
            page: nextPage,
            limit: 20,
            categorySlug: slug,
          );
      state = state.copyWith(
        title: category.name,
        items: reset ? page.items : [...state.items, ...page.items],
        pagination: page.pagination,
        isLoading: false,
        isLoadingMore: false,
        clearError: true,
      );
    } on AppFailure catch (failure) {
      state = state.copyWith(
        isLoading: false,
        isLoadingMore: false,
        errorMessage: failure.message,
      );
    }
  }
}

final categoryProductsViewModelProvider = NotifierProvider.family<
    CategoryProductsViewModel, ProductListState, String>(CategoryProductsViewModel.new);

class ProductDetailViewModel extends FamilyNotifier<AsyncValue<CatalogProductDetail>, String> {
  @override
  AsyncValue<CatalogProductDetail> build(String arg) {
    Future.microtask(load);
    return const AsyncValue.loading();
  }

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final product = await ref.read(catalogRepositoryProvider).getProduct(arg);
      state = AsyncValue.data(product);
    } on AppFailure catch (failure) {
      state = AsyncValue.error(failure, StackTrace.current);
    }
  }
}

final productDetailViewModelProvider = NotifierProvider.family<
    ProductDetailViewModel, AsyncValue<CatalogProductDetail>, String>(
  ProductDetailViewModel.new,
);

class SearchViewModel extends Notifier<ProductListState> {
  Timer? _debounce;

  @override
  ProductListState build() {
    ref.onDispose(() => _debounce?.cancel());
    return const ProductListState();
  }

  void onQueryChanged(String raw) {
    final query = raw.trim();
    state = state.copyWith(query: query, clearError: true);
    _debounce?.cancel();
    if (query.isEmpty) {
      state = const ProductListState();
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () {
      search(reset: true);
    });
  }

  Future<void> search({bool reset = false}) async {
    final query = state.query.trim();
    if (query.isEmpty) {
      state = const ProductListState();
      return;
    }

    final nextPage = reset ? 1 : (state.pagination?.page ?? 0) + 1;
    if (!reset && !state.hasMore) return;

    state = state.copyWith(
      isLoading: reset,
      isLoadingMore: !reset,
      clearError: true,
      query: query,
    );

    try {
      final page = await ref.read(catalogRepositoryProvider).listProducts(
            page: nextPage,
            limit: 20,
            q: query,
          );
      state = state.copyWith(
        items: reset ? page.items : [...state.items, ...page.items],
        pagination: page.pagination,
        isLoading: false,
        isLoadingMore: false,
        clearError: true,
        query: query,
      );
    } on AppFailure catch (failure) {
      state = state.copyWith(
        isLoading: false,
        isLoadingMore: false,
        errorMessage: failure.message,
        query: query,
      );
    }
  }

  Future<void> loadMore() => search(reset: false);
}

final searchViewModelProvider =
    NotifierProvider<SearchViewModel, ProductListState>(SearchViewModel.new);
