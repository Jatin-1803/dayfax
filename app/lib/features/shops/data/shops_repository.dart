import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/network/api_client.dart';
import '../domain/shop_models.dart';

final shopsRepositoryProvider = Provider<ShopsRepository>((ref) {
  return ShopsRepository(dio: ref.watch(dioProvider));
});

class ShopsRepository {
  ShopsRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<List<ShopSummary>> listPopular() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/stores',
        queryParameters: {'popular': 'true'},
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      final data = body['data'];
      if (data is! List) {
        throw const ServerFailure('Unexpected stores response.');
      }
      return data
          .whereType<Map<String, dynamic>>()
          .map(ShopSummary.fromJson)
          .toList();
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<ShopSummary> getShop(String idOrSlug) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/stores/$idOrSlug');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return ShopSummary.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }
}
