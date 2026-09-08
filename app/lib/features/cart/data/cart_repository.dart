import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/network/api_client.dart';
import '../domain/cart_models.dart';

final cartRepositoryProvider = Provider<CartRepository>((ref) {
  return CartRepository(dio: ref.watch(dioProvider));
});

class CartRepository {
  CartRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<Cart> getCart() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/cart');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return Cart.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<Cart> addItem({
    required String variantId,
    int quantity = 1,
    String? storeId,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/cart/items',
        data: {
          'variantId': variantId,
          'quantity': quantity,
          'storeId': ?storeId,
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return Cart.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<Cart> updateItem({required String itemId, required int quantity}) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/cart/items/$itemId',
        data: {'quantity': quantity},
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return Cart.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<Cart> removeItem(String itemId) async {
    try {
      final response = await _dio.delete<Map<String, dynamic>>('/cart/items/$itemId');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return Cart.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<Cart> clear() async {
    try {
      final response = await _dio.delete<Map<String, dynamic>>('/cart');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return Cart.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }
}
