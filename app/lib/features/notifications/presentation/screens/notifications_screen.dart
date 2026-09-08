import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_radius.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../notifications_view_model.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(notificationsViewModelProvider);
    final notifier = ref.read(notificationsViewModelProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: Text(ref.t('notifications.title')),
        actions: [
          if (state.unreadCount > 0)
            TextButton(
              onPressed: notifier.markAllRead,
              child: Text(ref.t('notifications.mark_all')),
            ),
        ],
      ),
      body: _buildBody(context, ref, state, notifier),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WidgetRef ref,
    NotificationsUiState state,
    NotificationsViewModel notifier,
  ) {
    if (state.isLoading && state.items.isEmpty) {
      return ListView.separated(
        padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
        itemCount: 6,
        separatorBuilder: (_, _) => const SizedBox(height: CustomerSpacing.sm),
        itemBuilder: (_, _) => const ListCardSkeleton(height: 72, borderRadius: CustomerRadius.md),
      );
    }
    if (state.errorMessage != null && state.items.isEmpty) {
      return ErrorState(
        message: state.errorMessage!,
        onRetry: () => notifier.load(reset: true),
      );
    }
    if (state.items.isEmpty) {
      return EmptyState(
        title: ref.t('notifications.empty_title'),
        message: ref.t('notifications.empty_message'),
        icon: Icons.notifications_none_outlined,
      );
    }

    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification.metrics.pixels >= notification.metrics.maxScrollExtent - 200 &&
            state.hasNextPage &&
            !state.isLoadingMore) {
          notifier.load();
        }
        return false;
      },
      child: RefreshIndicator(
        color: CustomerColors.primary,
        onRefresh: () => notifier.load(reset: true),
        child: ListView.separated(
          padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
          itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
          separatorBuilder: (_, _) => const SizedBox(height: CustomerSpacing.sm),
          itemBuilder: (context, index) {
            if (index >= state.items.length) {
              return const Padding(
                padding: EdgeInsets.all(CustomerSpacing.md),
                child: Center(child: CircularProgressIndicator()),
              );
            }
            final item = state.items[index];
            final time = DateFormat('dd MMM, h:mm a').format(item.createdAt.toLocal());
            return Material(
              color: item.isRead
                  ? CustomerColors.surfaceContainerLowest
                  : CustomerColors.primaryContainer.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(CustomerRadius.md),
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: CustomerSpacing.md,
                  vertical: CustomerSpacing.xs,
                ),
                leading: CircleAvatar(
                  backgroundColor: item.isRead
                      ? CustomerColors.surfaceContainer
                      : CustomerColors.primaryContainer,
                  child: Icon(
                    Icons.notifications_outlined,
                    color: item.isRead
                        ? CustomerColors.onSurfaceVariant
                        : CustomerColors.onPrimaryContainer,
                  ),
                ),
                title: Text(
                  item.title,
                  style: TextStyle(
                    fontWeight: item.isRead ? FontWeight.w500 : FontWeight.w700,
                  ),
                ),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 4),
                    Text(item.body),
                    const SizedBox(height: 4),
                    Text(
                      time,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: CustomerColors.onSurfaceVariant,
                          ),
                    ),
                  ],
                ),
                onTap: () async {
                  if (!item.isRead) {
                    await notifier.markRead(item.id);
                  }
                  final orderId = item.orderId;
                  if (orderId != null && context.mounted) {
                    context.push('/orders/$orderId/track');
                  }
                },
              ),
            );
          },
        ),
      ),
    );
  }
}
