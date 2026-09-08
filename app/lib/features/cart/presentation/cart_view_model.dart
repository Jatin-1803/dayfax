import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../orders/domain/delivery_quote.dart';
import '../data/cart_repository.dart';
import '../domain/cart_models.dart';

class CartUiState {
  const CartUiState({
    this.cart = const Cart(items: [], itemCount: 0, subtotalPaise: 0),
    this.isLoading = false,
    this.isMutating = false,
    this.errorMessage,
    this.actionMessage,
  });

  final Cart cart;
  final bool isLoading;
  final bool isMutating;
  final String? errorMessage;
  final String? actionMessage;

  CartUiState copyWith({
    Cart? cart,
    bool? isLoading,
    bool? isMutating,
    String? errorMessage,
    String? actionMessage,
    bool clearError = false,
    bool clearAction = false,
  }) {
    return CartUiState(
      cart: cart ?? this.cart,
      isLoading: isLoading ?? this.isLoading,
      isMutating: isMutating ?? this.isMutating,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      actionMessage: clearAction ? null : (actionMessage ?? this.actionMessage),
    );
  }
}

class CartViewModel extends Notifier<CartUiState> {
  @override
  CartUiState build() {
    Future.microtask(load);
    return const CartUiState(isLoading: true);
  }

  CartRepository get _repo => ref.read(cartRepositoryProvider);

  Future<void> load() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final cart = await _repo.getCart();
      state = state.copyWith(cart: cart, isLoading: false, clearError: true);
    } on AppFailure catch (failure) {
      state = state.copyWith(isLoading: false, errorMessage: failure.message);
    }
  }

  Future<bool> addVariant({
    required String variantId,
    int quantity = 1,
    String? storeId,
  }) async {
    if (state.isMutating) return false;
    state = state.copyWith(isMutating: true, clearError: true, clearAction: true);
    try {
      final cart = await _repo.addItem(
        variantId: variantId,
        quantity: quantity,
        storeId: storeId,
      );
      state = state.copyWith(
        cart: cart,
        isMutating: false,
        actionMessage: 'Added to cart',
        clearError: true,
      );
      ref.invalidate(deliveryQuoteProvider);
      return true;
    } on AppFailure catch (failure) {
      state = state.copyWith(isMutating: false, errorMessage: failure.message);
      return false;
    }
  }

  Future<void> setQuantity(String itemId, int quantity) async {
    if (state.isMutating) return;
    final previous = state.cart;

    List<CartItem> nextItems;
    if (quantity <= 0) {
      nextItems = previous.items.where((item) => item.id != itemId).toList();
    } else {
      nextItems = previous.items.map((item) {
        if (item.id != itemId) return item;
        return item.copyWith(
          quantity: quantity,
          lineTotalPaise: item.unitPricePaise * quantity,
        );
      }).toList();
    }

    final optimistic = Cart(
      id: previous.id,
      storeId: previous.storeId,
      serviceAreaId: previous.serviceAreaId,
      items: nextItems,
      itemCount: nextItems.fold<int>(0, (sum, item) => sum + item.quantity),
      subtotalPaise: nextItems.fold<int>(0, (sum, item) => sum + item.lineTotalPaise),
    );

    state = state.copyWith(cart: optimistic, isMutating: true, clearError: true);

    try {
      final cart = quantity <= 0
          ? await _repo.removeItem(itemId)
          : await _repo.updateItem(itemId: itemId, quantity: quantity);
      state = state.copyWith(cart: cart, isMutating: false, clearError: true);
      ref.invalidate(deliveryQuoteProvider);
    } on AppFailure catch (failure) {
      state = state.copyWith(
        cart: previous,
        isMutating: false,
        errorMessage: failure.message,
      );
    }
  }

  Future<void> clear() async {
    if (state.isMutating) return;
    state = state.copyWith(isMutating: true, clearError: true);
    try {
      final cart = await _repo.clear();
      state = state.copyWith(cart: cart, isMutating: false, clearError: true);
      ref.invalidate(deliveryQuoteProvider);
    } on AppFailure catch (failure) {
      state = state.copyWith(isMutating: false, errorMessage: failure.message);
    }
  }

  void consumeActionMessage() {
    if (state.actionMessage != null) {
      state = state.copyWith(clearAction: true);
    }
  }
}

final cartViewModelProvider =
    NotifierProvider<CartViewModel, CartUiState>(CartViewModel.new);

final cartItemCountProvider = Provider<int>((ref) {
  return ref.watch(cartViewModelProvider.select((s) => s.cart.itemCount));
});

final cartQuantityByVariantProvider = Provider.family<int, String>((ref, variantId) {
  final items = ref.watch(cartViewModelProvider.select((s) => s.cart.items));
  for (final item in items) {
    if (item.variantId == variantId) return item.quantity;
  }
  return 0;
});

final cartItemIdByVariantProvider = Provider.family<String?, String>((ref, variantId) {
  final items = ref.watch(cartViewModelProvider.select((s) => s.cart.items));
  for (final item in items) {
    if (item.variantId == variantId) return item.id;
  }
  return null;
});
