import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../data/notifications_repository.dart';
import '../domain/notification_models.dart';

class NotificationsUiState {
  const NotificationsUiState({
    this.items = const [],
    this.unreadCount = 0,
    this.isLoading = false,
    this.isLoadingMore = false,
    this.hasNextPage = false,
    this.page = 0,
    this.errorMessage,
  });

  final List<AppNotification> items;
  final int unreadCount;
  final bool isLoading;
  final bool isLoadingMore;
  final bool hasNextPage;
  final int page;
  final String? errorMessage;

  NotificationsUiState copyWith({
    List<AppNotification>? items,
    int? unreadCount,
    bool? isLoading,
    bool? isLoadingMore,
    bool? hasNextPage,
    int? page,
    String? errorMessage,
    bool clearError = false,
  }) {
    return NotificationsUiState(
      items: items ?? this.items,
      unreadCount: unreadCount ?? this.unreadCount,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      hasNextPage: hasNextPage ?? this.hasNextPage,
      page: page ?? this.page,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class NotificationsViewModel extends Notifier<NotificationsUiState> {
  @override
  NotificationsUiState build() {
    Future.microtask(() => load(reset: true));
    return const NotificationsUiState(isLoading: true);
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
      final page = await ref.read(notificationsRepositoryProvider).list(page: nextPage);
      state = state.copyWith(
        items: reset ? page.items : [...state.items, ...page.items],
        unreadCount: page.unreadCount,
        page: page.page,
        hasNextPage: page.hasNextPage,
        isLoading: false,
        isLoadingMore: false,
        clearError: true,
      );
      ref.read(notificationsUnreadCountProvider.notifier).state = page.unreadCount;
    } on AppFailure catch (failure) {
      state = state.copyWith(
        isLoading: false,
        isLoadingMore: false,
        errorMessage: failure.message,
      );
    }
  }

  Future<void> markRead(String id) async {
    try {
      final updated = await ref.read(notificationsRepositoryProvider).markRead(id);
      final items = state.items
          .map((item) => item.id == id ? updated : item)
          .toList(growable: false);
      final unread = items.where((item) => !item.isRead).length;
      state = state.copyWith(items: items, unreadCount: unread);
      ref.read(notificationsUnreadCountProvider.notifier).state = unread;
    } on AppFailure catch (failure) {
      state = state.copyWith(errorMessage: failure.message);
    }
  }

  Future<void> markAllRead() async {
    try {
      final unread = await ref.read(notificationsRepositoryProvider).markAllRead();
      final items = state.items
          .map(
            (item) => AppNotification(
              id: item.id,
              title: item.title,
              body: item.body,
              channel: item.channel,
              isRead: true,
              createdAt: item.createdAt,
              meta: item.meta,
            ),
          )
          .toList(growable: false);
      state = state.copyWith(items: items, unreadCount: unread);
      ref.read(notificationsUnreadCountProvider.notifier).state = unread;
    } on AppFailure catch (failure) {
      state = state.copyWith(errorMessage: failure.message);
    }
  }
}

final notificationsViewModelProvider =
    NotifierProvider<NotificationsViewModel, NotificationsUiState>(NotificationsViewModel.new);

final StateProvider<int> notificationsUnreadCountProvider = StateProvider<int>((ref) {
  Future.microtask(() async {
    try {
      final count = await ref.read(notificationsRepositoryProvider).unreadCount();
      ref.read(notificationsUnreadCountProvider.notifier).state = count;
    } catch (_) {
      // Badge stays at 0 until notifications screen loads.
    }
  });
  return 0;
});
