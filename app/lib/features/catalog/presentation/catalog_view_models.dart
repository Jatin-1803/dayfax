import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/i18n/i18n_providers.dart';
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
    required this.popular,
    required this.grocery,
    required this.vegetables,
    required this.cosmetics,
  });

  final List<CatalogCategory> categories;
  final List<CatalogProduct> popular;
  final List<CatalogProduct> grocery;
  final List<CatalogProduct> vegetables;
  final List<CatalogProduct> cosmetics;
}

class CatalogError extends CatalogUiState {
  const CatalogError(this.message);

  final String message;
}

class HomeCatalogViewModel extends Notifier<CatalogUiState> {
  @override
  CatalogUiState build() {
    ref.listen(appLangCodeProvider, (previous, next) {
      if (previous != null && previous != next) {
        load();
      }
    });
    Future.microtask(load);
    return const CatalogLoading();
  }

  CatalogRepository get _repo => ref.read(catalogRepositoryProvider);
  String get _lang => ref.read(appLangCodeProvider);

  Future<void> load() async {
    state = const CatalogLoading();
    try {
      final lang = _lang;
      final results = await Future.wait([
        _repo.listCategories(lang: lang),
        _repo.listProducts(page: 1, limit: 16, lang: lang),
        _productsForSlug('grocery', lang: lang),
        _productsForSlug('vegetables', lang: lang),
        _productsForSlug('cosmetics', lang: lang),
      ]);
      state = CatalogReady(
        categories: results[0] as List<CatalogCategory>,
        popular: (results[1] as ProductPage).items,
        grocery: results[2] as List<CatalogProduct>,
        vegetables: results[3] as List<CatalogProduct>,
        cosmetics: results[4] as List<CatalogProduct>,
      );
    } on AppFailure catch (failure) {
      state = CatalogError(failure.message);
    }
  }

  /// Missing category rails must not fail the whole home screen.
  Future<List<CatalogProduct>> _productsForSlug(
    String categorySlug, {
    required String lang,
  }) async {
    try {
      final page = await _repo.listProducts(
        page: 1,
        limit: 12,
        categorySlug: categorySlug,
        lang: lang,
      );
      return page.items;
    } on NotFoundFailure {
      return const [];
    }
  }
}

final homeCatalogViewModelProvider =
    NotifierProvider<HomeCatalogViewModel, CatalogUiState>(HomeCatalogViewModel.new);

class CategoriesListViewModel extends Notifier<AsyncValue<List<CatalogCategory>>> {
  @override
  AsyncValue<List<CatalogCategory>> build() {
    ref.listen(appLangCodeProvider, (previous, next) {
      if (previous != null && previous != next) {
        load();
      }
    });
    Future.microtask(load);
    return const AsyncValue.loading();
  }

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final categories = await ref
          .read(catalogRepositoryProvider)
          .listCategories(lang: ref.read(appLangCodeProvider));
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
    this.rewrittenFor,
    this.subcategories = const [],
    this.selectedSubSlug,
  });

  final List<CatalogProduct> items;
  final PaginationMeta? pagination;
  final bool isLoading;
  final bool isLoadingMore;
  final String? errorMessage;
  final String query;
  final String? categorySlug;
  final String? title;
  final String? rewrittenFor;
  final List<CatalogCategory> subcategories;
  final String? selectedSubSlug;

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
    String? rewrittenFor,
    bool clearRewrittenFor = false,
    List<CatalogCategory>? subcategories,
    String? selectedSubSlug,
    bool clearSelectedSubSlug = false,
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
      rewrittenFor: clearRewrittenFor ? null : (rewrittenFor ?? this.rewrittenFor),
      subcategories: subcategories ?? this.subcategories,
      selectedSubSlug:
          clearSelectedSubSlug ? null : (selectedSubSlug ?? this.selectedSubSlug),
    );
  }
}

class CategoryProductsViewModel extends FamilyNotifier<ProductListState, String> {
  Timer? _debounce;

  @override
  ProductListState build(String arg) {
    ref.onDispose(() => _debounce?.cancel());
    ref.listen(appLangCodeProvider, (previous, next) {
      if (previous != null && previous != next) {
        load(reset: true);
      }
    });
    Future.microtask(() => load(reset: true));
    return ProductListState(categorySlug: arg, isLoading: true);
  }

  void onFilterChanged(String raw) {
    final query = raw.trim();
    state = state.copyWith(query: query, clearError: true);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      load(reset: true);
    });
  }

  void selectSubCategory(String? slug) {
    if (state.selectedSubSlug == slug) return;
    _debounce?.cancel();
    state = state.copyWith(
      selectedSubSlug: slug,
      clearSelectedSubSlug: slug == null,
      query: '',
      clearError: true,
    );
    load(reset: true);
  }

  Future<void> load({bool reset = false}) async {
    final parentSlug = arg;
    final nextPage = reset ? 1 : (state.pagination?.page ?? 0) + 1;
    if (!reset && !state.hasMore) return;
    final lang = ref.read(appLangCodeProvider);
    final query = state.query.trim();
    final selectedSubSlug = state.selectedSubSlug;

    state = state.copyWith(
      isLoading: reset,
      isLoadingMore: !reset,
      clearError: true,
      items: reset ? const [] : null,
    );

    try {
      final repo = ref.read(catalogRepositoryProvider);
      var title = state.title;
      var subcategories = state.subcategories;
      if (reset) {
        final category = await repo.getCategory(parentSlug, lang: lang);
        title = category.name;
        subcategories = await repo.listCategories(parentId: category.id, lang: lang);
      }

      final selectedStillValid = selectedSubSlug != null &&
          subcategories.any((category) => category.slug == selectedSubSlug);
      final productSlug = selectedStillValid ? selectedSubSlug : parentSlug;

      final page = await repo.listProducts(
        page: nextPage,
        limit: 20,
        categorySlug: productSlug,
        q: query.isEmpty ? null : query,
        lang: lang,
      );
      state = state.copyWith(
        title: title,
        subcategories: subcategories,
        items: reset ? page.items : [...state.items, ...page.items],
        pagination: page.pagination,
        isLoading: false,
        isLoadingMore: false,
        clearError: true,
        selectedSubSlug: selectedStillValid ? selectedSubSlug : null,
        clearSelectedSubSlug: !selectedStillValid,
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
    ref.listen(appLangCodeProvider, (previous, next) {
      if (previous != null && previous != next) {
        load();
      }
    });
    Future.microtask(load);
    return const AsyncValue.loading();
  }

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final product = await ref
          .read(catalogRepositoryProvider)
          .getProduct(arg, lang: ref.read(appLangCodeProvider));
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

class SimilarProductsViewModel extends FamilyNotifier<AsyncValue<List<CatalogProduct>>, String> {
  @override
  AsyncValue<List<CatalogProduct>> build(String arg) {
    ref.listen(appLangCodeProvider, (previous, next) {
      if (previous != null && previous != next) {
        load();
      }
    });
    Future.microtask(load);
    return const AsyncValue.loading();
  }

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final items = await ref.read(catalogRepositoryProvider).listSimilarProducts(
            arg,
            lang: ref.read(appLangCodeProvider),
          );
      state = AsyncValue.data(items);
    } on AppFailure catch (failure) {
      state = AsyncValue.error(failure, StackTrace.current);
    }
  }
}

final similarProductsViewModelProvider = NotifierProvider.family<
    SimilarProductsViewModel, AsyncValue<List<CatalogProduct>>, String>(
  SimilarProductsViewModel.new,
);

class SearchViewModel extends Notifier<ProductListState> {
  Timer? _debounce;

  @override
  ProductListState build() {
    ref.onDispose(() => _debounce?.cancel());
    ref.listen(appLangCodeProvider, (previous, next) {
      if (previous != null && previous != next && state.query.trim().isNotEmpty) {
        search(reset: true);
      }
    });
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
            lang: ref.read(appLangCodeProvider),
          );
      state = state.copyWith(
        items: reset ? page.items : [...state.items, ...page.items],
        pagination: page.pagination,
        isLoading: false,
        isLoadingMore: false,
        clearError: true,
        query: query,
        rewrittenFor: reset ? page.rewrittenFor : state.rewrittenFor,
        clearRewrittenFor: reset && page.rewrittenFor == null,
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

class TopSellingProductsViewModel extends Notifier<AsyncValue<List<CatalogProduct>>> {
  @override
  AsyncValue<List<CatalogProduct>> build() {
    ref.listen(appLangCodeProvider, (previous, next) {
      if (previous != null && previous != next) {
        load();
      }
    });
    Future.microtask(load);
    return const AsyncValue.loading();
  }

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final page = await ref.read(catalogRepositoryProvider).listProducts(
            page: 1,
            limit: 12,
            popular: true,
            lang: ref.read(appLangCodeProvider),
          );
      state = AsyncValue.data(page.items);
    } on AppFailure catch (failure) {
      state = AsyncValue.error(failure, StackTrace.current);
    }
  }
}

final topSellingProductsViewModelProvider =
    NotifierProvider<TopSellingProductsViewModel, AsyncValue<List<CatalogProduct>>>(
  TopSellingProductsViewModel.new,
);
