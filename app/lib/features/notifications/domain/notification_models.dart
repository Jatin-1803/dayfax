import 'package:equatable/equatable.dart';

class AppNotification extends Equatable {
  const AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.channel,
    required this.isRead,
    required this.createdAt,
    this.meta,
  });

  final String id;
  final String title;
  final String body;
  final String channel;
  final bool isRead;
  final DateTime createdAt;
  final Map<String, dynamic>? meta;

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    final metaJson = json['meta'];
    return AppNotification(
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      channel: json['channel'] as String? ?? 'IN_APP',
      isRead: json['isRead'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
      meta: metaJson is Map<String, dynamic> ? metaJson : null,
    );
  }

  String? get orderId {
    final value = meta?['orderId'];
    return value is String ? value : null;
  }

  @override
  List<Object?> get props => [id, isRead, createdAt];
}

class NotificationsPage extends Equatable {
  const NotificationsPage({
    required this.items,
    required this.unreadCount,
    required this.hasNextPage,
    required this.page,
  });

  final List<AppNotification> items;
  final int unreadCount;
  final bool hasNextPage;
  final int page;

  factory NotificationsPage.fromJson(Map<String, dynamic> json) {
    final pagination = json['pagination'] as Map<String, dynamic>? ?? const {};
    final itemsJson = json['items'] as List<dynamic>? ?? const [];
    return NotificationsPage(
      items: itemsJson
          .whereType<Map<String, dynamic>>()
          .map(AppNotification.fromJson)
          .toList(),
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      hasNextPage: pagination['hasNextPage'] as bool? ?? false,
      page: (pagination['page'] as num?)?.toInt() ?? 1,
    );
  }

  @override
  List<Object?> get props => [items, unreadCount, hasNextPage, page];
}
