import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../data/shops_repository.dart';
import '../domain/shop_models.dart';

class PopularShopsState {
  const PopularShopsState({
    this.shops = const [],
    this.isLoading = false,
    this.errorMessage,
  });

  final List<ShopSummary> shops;
  final bool isLoading;
  final String? errorMessage;

  PopularShopsState copyWith({
    List<ShopSummary>? shops,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
  }) {
    return PopularShopsState(
      shops: shops ?? this.shops,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class PopularShopsViewModel extends Notifier<PopularShopsState> {
  @override
  PopularShopsState build() {
    Future.microtask(load);
    return const PopularShopsState(isLoading: true);
  }

  Future<void> load() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final shops = await ref.read(shopsRepositoryProvider).listPopular();
      state = state.copyWith(shops: shops, isLoading: false, clearError: true);
    } on AppFailure catch (failure) {
      state = state.copyWith(isLoading: false, errorMessage: failure.message);
    }
  }
}

final popularShopsViewModelProvider =
    NotifierProvider<PopularShopsViewModel, PopularShopsState>(
  PopularShopsViewModel.new,
);

class ShopDetailState {
  const ShopDetailState({
    this.shop,
    this.items = const [],
    this.isLoading = true,
    this.isLoadingMore = false,
    this.hasMore = false,
    this.page = 0,
    this.query = '',
    this.errorMessage,
  });

  final ShopSummary? shop;
  final List<CatalogProduct> items;
  final bool isLoading;
  final bool isLoadingMore;
  final bool hasMore;
  final int page;
  final String query;
  final String? errorMessage;

  ShopDetailState copyWith({
    ShopSummary? shop,
    List<CatalogProduct>? items,
    bool? isLoading,
    bool? isLoadingMore,
    bool? hasMore,
    int? page,
    String? query,
    String? errorMessage,
    bool clearError = false,
  }) {
    return ShopDetailState(
      shop: shop ?? this.shop,
      items: items ?? this.items,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      hasMore: hasMore ?? this.hasMore,
      page: page ?? this.page,
      query: query ?? this.query,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class ShopDetailViewModel extends FamilyNotifier<ShopDetailState, String> {
  Timer? _debounce;

  @override
  ShopDetailState build(String arg) {
    ref.onDispose(() => _debounce?.cancel());
    Future.microtask(() => load(reset: true));
    return const ShopDetailState();
  }

  void onQueryChanged(String raw) {
    final query = raw.trim();
    state = state.copyWith(query: query, clearError: true);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      load(reset: true);
    });
  }

  Future<void> load({bool reset = false}) async {
    final current = state;
    if (reset) {
      state = ShopDetailState(
        shop: current.shop,
        isLoading: true,
        query: current.query,
      );
    } else {
      if (!current.hasMore || current.isLoadingMore) return;
      state = current.copyWith(isLoadingMore: true, clearError: true);
    }

    try {
      final shopsRepo = ref.read(shopsRepositoryProvider);
      final catalogRepo = ref.read(catalogRepositoryProvider);
      final shop = reset || current.shop == null
          ? await shopsRepo.getShop(arg)
          : current.shop!;
      final nextPage = reset ? 1 : current.page + 1;
      final q = state.query.trim();
      final page = await catalogRepo.listProducts(
        page: nextPage,
        limit: 20,
        storeId: shop.id,
        q: q.isEmpty ? null : q,
      );
      state = state.copyWith(
        shop: shop,
        items: reset ? page.items : [...current.items, ...page.items],
        page: nextPage,
        hasMore: page.pagination.hasNextPage,
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

final shopDetailViewModelProvider =
    NotifierProvider.family<ShopDetailViewModel, ShopDetailState, String>(
  ShopDetailViewModel.new,
);
