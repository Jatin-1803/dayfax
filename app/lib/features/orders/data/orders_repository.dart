import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/network/api_client.dart';
import '../domain/delivery_quote.dart';
import '../domain/order_models.dart';

final ordersRepositoryProvider = Provider<OrdersRepository>((ref) {
  return OrdersRepository(dio: ref.watch(dioProvider));
});

class OrdersRepository {
  OrdersRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<CheckoutResult> checkout({
    required String addressId,
    String paymentMethod = 'COD',
    String? notes,
    String? idempotencyKey,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/orders/checkout',
        data: {
          'addressId': addressId,
          'paymentMethod': paymentMethod,
          if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
          if (idempotencyKey != null && idempotencyKey.isNotEmpty)
            'idempotencyKey': idempotencyKey,
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return CheckoutResult.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<CustomerOrder> verifyPayment({
    required String orderId,
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/orders/$orderId/payments/verify',
        data: {
          'razorpayOrderId': razorpayOrderId,
          'razorpayPaymentId': razorpayPaymentId,
          'razorpaySignature': razorpaySignature,
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return CustomerOrder.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<OrdersPage> list({int page = 1, int limit = 20}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/orders',
        queryParameters: {'page': page, 'limit': limit},
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return OrdersPage.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<CustomerOrder> getOne(String idOrNumber) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/orders/$idOrNumber');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return CustomerOrder.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<DeliveryQuote> fetchQuote({String? addressId}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/orders/quote',
        queryParameters: {
          if (addressId != null && addressId.isNotEmpty) 'addressId': addressId,
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return DeliveryQuote.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }
}
