import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../data/delivery_repository.dart';
import '../domain/delivery_models.dart';

final deliveryStatsProvider =
    AsyncNotifierProvider<DeliveryStatsNotifier, DeliveryStats>(DeliveryStatsNotifier.new);

class DeliveryStatsNotifier extends AsyncNotifier<DeliveryStats> {
  @override
  Future<DeliveryStats> build() => _fetch();

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_fetch);
  }

  Future<DeliveryStats> _fetch() {
    return ref.read(deliveryRepositoryProvider).fetchStats();
  }
}

class DeliveryJobsListState {
  const DeliveryJobsListState({
    this.items = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.hasNextPage = false,
    this.page = 0,
    this.errorMessage,
  });

  final List<DeliveryJob> items;
  final bool isLoading;
  final bool isLoadingMore;
  final bool hasNextPage;
  final int page;
  final String? errorMessage;

  DeliveryJobsListState copyWith({
    List<DeliveryJob>? items,
    bool? isLoading,
    bool? isLoadingMore,
    bool? hasNextPage,
    int? page,
    String? errorMessage,
    bool clearError = false,
  }) {
    return DeliveryJobsListState(
      items: items ?? this.items,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      hasNextPage: hasNextPage ?? this.hasNextPage,
      page: page ?? this.page,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class DeliveryJobsListNotifier extends FamilyNotifier<DeliveryJobsListState, DeliveryJobsTab> {
  @override
  DeliveryJobsListState build(DeliveryJobsTab arg) {
    Future.microtask(() => load(reset: true));
    return const DeliveryJobsListState(isLoading: true);
  }

  Future<void> load({bool reset = false}) async {
    if (!reset && !state.hasNextPage) return;
    final nextPage = reset ? 1 : state.page + 1;
    state = state.copyWith(
      isLoading: reset,
      isLoadingMore: !reset,
      clearError: true,
    );
    try {
      final page = await ref.read(deliveryRepositoryProvider).listJobs(
            tab: arg,
            page: nextPage,
          );
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

  Future<void> refresh() => load(reset: true);
}

final deliveryJobsListProvider = NotifierProvider.family<
    DeliveryJobsListNotifier, DeliveryJobsListState, DeliveryJobsTab>(
  DeliveryJobsListNotifier.new,
);

class DeliveryJobDetailNotifier extends FamilyNotifier<AsyncValue<DeliveryJob>, String> {
  @override
  AsyncValue<DeliveryJob> build(String arg) {
    Future.microtask(load);
    return const AsyncValue.loading();
  }

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final job = await ref.read(deliveryRepositoryProvider).getJob(arg);
      state = AsyncValue.data(job);
    } on AppFailure catch (failure) {
      state = AsyncValue.error(failure, StackTrace.current);
    }
  }
}

final deliveryJobDetailProvider = NotifierProvider.family<
    DeliveryJobDetailNotifier, AsyncValue<DeliveryJob>, String>(
  DeliveryJobDetailNotifier.new,
);

void invalidateDeliveryData(WidgetRef ref) {
  ref.invalidate(deliveryStatsProvider);
  for (final tab in DeliveryJobsTab.values) {
    ref.invalidate(deliveryJobsListProvider(tab));
  }
}
