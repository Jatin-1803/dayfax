import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../addresses/data/addresses_repository.dart';
import '../../addresses/domain/address_models.dart';
import '../../cart/presentation/cart_view_model.dart';
import '../data/orders_repository.dart';
import '../domain/order_models.dart';

class CheckoutUiState {
  const CheckoutUiState({
    this.addresses = const [],
    this.selectedAddressId,
    this.paymentMethod = 'COD',
    this.notes = '',
    this.isLoading = false,
    this.isPlacing = false,
    this.errorMessage,
    this.placedOrder,
  });

  final List<UserAddress> addresses;
  final String? selectedAddressId;
  final String paymentMethod;
  final String notes;
  final bool isLoading;
  final bool isPlacing;
  final String? errorMessage;
  final CustomerOrder? placedOrder;

  UserAddress? get selectedAddress {
    for (final address in addresses) {
      if (address.id == selectedAddressId) return address;
    }
    return null;
  }

  CheckoutUiState copyWith({
    List<UserAddress>? addresses,
    String? selectedAddressId,
    String? paymentMethod,
    String? notes,
    bool? isLoading,
    bool? isPlacing,
    String? errorMessage,
    CustomerOrder? placedOrder,
    bool clearError = false,
    bool clearPlaced = false,
    bool clearSelectedAddress = false,
  }) {
    return CheckoutUiState(
      addresses: addresses ?? this.addresses,
      selectedAddressId: clearSelectedAddress
          ? null
          : (selectedAddressId ?? this.selectedAddressId),
      paymentMethod: paymentMethod ?? this.paymentMethod,
      notes: notes ?? this.notes,
      isLoading: isLoading ?? this.isLoading,
      isPlacing: isPlacing ?? this.isPlacing,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      placedOrder: clearPlaced ? null : (placedOrder ?? this.placedOrder),
    );
  }
}

class CheckoutViewModel extends Notifier<CheckoutUiState> {
  @override
  CheckoutUiState build() {
    Future.microtask(load);
    return const CheckoutUiState(isLoading: true);
  }

  Future<void> load() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final addresses = await ref.read(addressesRepositoryProvider).list();
      String? nextId = state.selectedAddressId;
      final stillValid = nextId != null && addresses.any((address) => address.id == nextId);
      if (!stillValid) {
        nextId = null;
        for (final address in addresses) {
          if (address.isDefault) {
            nextId = address.id;
            break;
          }
        }
        nextId ??= addresses.isEmpty ? null : addresses.first.id;
      }
      state = state.copyWith(
        addresses: addresses,
        selectedAddressId: nextId,
        clearSelectedAddress: nextId == null,
        isLoading: false,
        clearError: true,
      );
    } on AppFailure catch (failure) {
      state = state.copyWith(isLoading: false, errorMessage: failure.message);
    }
  }

  void selectAddress(String id) {
    state = state.copyWith(selectedAddressId: id, clearError: true);
  }

  void selectPaymentMethod(String method) {
    state = state.copyWith(paymentMethod: method, clearError: true);
  }

  void setNotes(String notes) {
    state = state.copyWith(notes: notes);
  }

  Future<CheckoutResult?> placeOrder() async {
    if (state.isPlacing) return null;
    final addressId = state.selectedAddress?.id;
    if (addressId == null) {
      state = state.copyWith(errorMessage: 'checkout.add_address_to_order');
      return null;
    }

    final idempotencyKey =
        'chk_${DateTime.now().microsecondsSinceEpoch}_${Random().nextInt(1 << 32)}';

    final cart = ref.read(cartViewModelProvider).cart;
    final paymentMethod = cart.requiresOnlineOnly ? 'UPI' : state.paymentMethod;
    if (cart.requiresOnlineOnly && state.paymentMethod != 'UPI') {
      state = state.copyWith(paymentMethod: 'UPI');
    }

    state = state.copyWith(isPlacing: true, clearError: true, clearPlaced: true);
    try {
      final result = await ref.read(ordersRepositoryProvider).checkout(
            addressId: addressId,
            paymentMethod: paymentMethod,
            notes: state.notes,
            idempotencyKey: idempotencyKey,
          );
      await ref.read(cartViewModelProvider.notifier).load();
      ref.invalidate(ordersListViewModelProvider);
      state = state.copyWith(
        isPlacing: false,
        placedOrder: result.order,
        clearError: true,
      );
      return result;
    } on AppFailure catch (failure) {
      state = state.copyWith(isPlacing: false, errorMessage: failure.message);
      return null;
    }
  }

  Future<CustomerOrder?> verifyRazorpayPayment({
    required String orderId,
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    if (state.isPlacing) return null;
    state = state.copyWith(isPlacing: true, clearError: true);
    try {
      final order = await ref.read(ordersRepositoryProvider).verifyPayment(
            orderId: orderId,
            razorpayOrderId: razorpayOrderId,
            razorpayPaymentId: razorpayPaymentId,
            razorpaySignature: razorpaySignature,
          );
      ref.invalidate(ordersListViewModelProvider);
      state = state.copyWith(isPlacing: false, placedOrder: order, clearError: true);
      return order;
    } on AppFailure catch (failure) {
      state = state.copyWith(isPlacing: false, errorMessage: failure.message);
      return null;
    }
  }
}

final checkoutViewModelProvider =
    NotifierProvider<CheckoutViewModel, CheckoutUiState>(CheckoutViewModel.new);

class OrdersListState {
  const OrdersListState({
    this.items = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.hasNextPage = false,
    this.page = 0,
    this.errorMessage,
  });

  final List<CustomerOrder> items;
  final bool isLoading;
  final bool isLoadingMore;
  final bool hasNextPage;
  final int page;
  final String? errorMessage;

  OrdersListState copyWith({
    List<CustomerOrder>? items,
    bool? isLoading,
    bool? isLoadingMore,
    bool? hasNextPage,
    int? page,
    String? errorMessage,
    bool clearError = false,
  }) {
    return OrdersListState(
      items: items ?? this.items,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      hasNextPage: hasNextPage ?? this.hasNextPage,
      page: page ?? this.page,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class OrdersListViewModel extends Notifier<OrdersListState> {
  @override
  OrdersListState build() {
    Future.microtask(() => load(reset: true));
    return const OrdersListState(isLoading: true);
  }

  Future<void> load({bool reset = false, bool silent = false}) async {
    if (!reset && !state.hasNextPage) return;
    final nextPage = reset ? 1 : state.page + 1;
    final keepVisible = silent && reset && state.items.isNotEmpty;
    state = state.copyWith(
      isLoading: reset && !keepVisible,
      isLoadingMore: !reset,
      clearError: true,
    );
    try {
      final page = await ref.read(ordersRepositoryProvider).list(page: nextPage);
      state = state.copyWith(
        items: reset ? page.items : [...state.items, ...page.items],
        page: page.page,
        hasNextPage: page.hasNextPage,
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

  /// Keeps list chips in sync when a detail/track screen loads fresher data.
  void patchOrder(CustomerOrder order) {
    final index = state.items.indexWhere(
      (item) => item.id == order.id || item.orderNumber == order.orderNumber,
    );
    if (index < 0) return;
    final current = state.items[index];
    if (current.status == order.status &&
        current.returnRequest?.status == order.returnRequest?.status &&
        current.payment?.status == order.payment?.status) {
      return;
    }
    final items = [...state.items];
    items[index] = order;
    state = state.copyWith(items: items);
  }
}

final ordersListViewModelProvider =
    NotifierProvider<OrdersListViewModel, OrdersListState>(OrdersListViewModel.new);

class OrderDetailViewModel extends Notifier<AsyncValue<CustomerOrder>> {
  OrderDetailViewModel(this.arg);

  final String arg;

  @override
  AsyncValue<CustomerOrder> build() {
    Future.microtask(load);
    return const AsyncValue.loading();
  }

  Future<void> load({bool silent = false}) async {
    if (!silent || !state.hasValue) {
      state = const AsyncValue.loading();
    }
    try {
      final order = await ref.read(ordersRepositoryProvider).getOne(arg);
      state = AsyncValue.data(order);
      ref.read(ordersListViewModelProvider.notifier).patchOrder(order);
    } on AppFailure catch (failure) {
      if (silent && state.hasValue) return;
      state = AsyncValue.error(failure, StackTrace.current);
    }
  }
}

final orderDetailViewModelProvider =
    NotifierProvider.family<OrderDetailViewModel, AsyncValue<CustomerOrder>, String>(
  OrderDetailViewModel.new,
);
