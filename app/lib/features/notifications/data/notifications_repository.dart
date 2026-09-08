import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/network/api_client.dart';
import '../domain/notification_models.dart';

final notificationsRepositoryProvider = Provider<NotificationsRepository>((ref) {
  return NotificationsRepository(dio: ref.watch(dioProvider));
});

class NotificationsRepository {
  NotificationsRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<NotificationsPage> list({int page = 1, int limit = 20}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/notifications',
        queryParameters: {'page': page, 'limit': limit},
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return NotificationsPage.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<int> unreadCount() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/notifications/unread-count');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      final data = body['data'] as Map<String, dynamic>? ?? const {};
      return (data['unreadCount'] as num?)?.toInt() ?? 0;
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<AppNotification> markRead(String id) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>('/notifications/$id/read');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return AppNotification.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<int> markAllRead() async {
    try {
      final response = await _dio.post<Map<String, dynamic>>('/notifications/read-all');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      final data = body['data'] as Map<String, dynamic>? ?? const {};
      return (data['unreadCount'] as num?)?.toInt() ?? 0;
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }
}
