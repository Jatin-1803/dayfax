import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/network/api_client.dart';
import '../domain/delivery_models.dart';

final deliveryRepositoryProvider = Provider<DeliveryRepository>((ref) {
  return DeliveryRepository(dio: ref.watch(dioProvider));
});

class DeliveryRepository {
  DeliveryRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<DeliveryStats> fetchStats({required String date}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/delivery/stats',
        queryParameters: {'date': date},
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return DeliveryStats.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<DeliveryJobsPage> listJobs({
    required DeliveryJobsTab tab,
    int page = 1,
    int limit = 20,
    String? date,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/delivery/jobs',
        queryParameters: {
          'tab': tab.apiValue,
          'page': page,
          'limit': limit,
          if (tab == DeliveryJobsTab.completed && date != null) 'date': date,
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return DeliveryJobsPage.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<DeliveryJob> getJob(String idOrOrderId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/delivery/jobs/$idOrOrderId');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return DeliveryJob.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<DeliveryJob> claimJob(String orderId) {
    return acceptOrder(orderId);
  }

  Future<DeliveryJob> acceptOrder(String orderId) async {
    try {
      final response =
          await _dio.post<Map<String, dynamic>>('/delivery/orders/$orderId/accept');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return DeliveryJob.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDeliveryActionError(error);
    }
  }

  Future<DeliveryJob> acceptReturn(String returnRequestId) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/delivery/returns/$returnRequestId/accept',
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return DeliveryJob.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDeliveryActionError(error);
    }
  }

  Future<DeliveryJob> acceptJob(String assignmentId) async {
    try {
      final response =
          await _dio.post<Map<String, dynamic>>('/delivery/jobs/$assignmentId/accept');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return DeliveryJob.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<DeliveryJob> updateStatus({
    required String assignmentId,
    required String status,
    String? note,
    String? deliveryOtp,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/delivery/jobs/$assignmentId/status',
        data: {
          'status': status,
          if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
          if (deliveryOtp != null && deliveryOtp.trim().isNotEmpty)
            'deliveryOtp': deliveryOtp.trim(),
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return DeliveryJob.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDeliveryActionError(error);
    }
  }

  Future<PaymentQrSession> createPaymentQr(String orderId) async {
    try {
      final response =
          await _dio.post<Map<String, dynamic>>('/delivery/orders/$orderId/payment/qr');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return PaymentQrSession.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDeliveryActionError(error);
    }
  }

  Future<PaymentCheckResult> checkPayment(String orderId) async {
    try {
      final response =
          await _dio.post<Map<String, dynamic>>('/delivery/orders/$orderId/payment/check');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return PaymentCheckResult.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDeliveryActionError(error);
    }
  }

  Future<PaymentCheckResult> collectCash(String orderId) async {
    try {
      final response =
          await _dio.post<Map<String, dynamic>>('/delivery/orders/$orderId/payment/cash');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return PaymentCheckResult.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDeliveryActionError(error);
    }
  }
}

AppFailure mapDeliveryActionError(Object error) {
  if (error is DioException && error.response?.data is Map) {
    final data = error.response!.data as Map;
    final errorBody = data['error'];
    final code = errorBody is Map ? errorBody['code'] as String? : null;
    if (code == 'OTP_INVALID' || code == 'OTP_ATTEMPTS_EXHAUSTED') {
      return mapDeliveryOtpFailure(code!, errorBody is Map ? errorBody['details'] : null);
    }
    final mapped = switch (code) {
      'ORDER_NOT_AVAILABLE' => 'delivery.order_not_available',
      'ORDER_ALREADY_ACCEPTED' => 'delivery.order_already_assigned',
      'ORDER_ALREADY_ASSIGNED' => 'delivery.order_already_assigned',
      'ORDER_CANCELLED' => 'delivery.order_cancelled',
      'ORDER_ALREADY_DELIVERED' => 'delivery.order_already_delivered',
      'PAYMENT_PENDING' => 'delivery.payment_still_pending',
      'PAYMENT_AMOUNT_MISMATCH' => 'delivery.payment_amount_mismatch',
      'PAYMENT_VERIFICATION_PENDING' => 'delivery.payment_verify_failed',
      'OTP_NOT_ALLOWED' => 'delivery.otp_locked',
      'OTP_NOT_SET' => 'delivery.otp_missing',
      _ => null,
    };
    if (mapped != null) {
      if (error.response?.statusCode == 409) return ConflictFailure(mapped);
      return ValidationFailure(mapped);
    }
  }
  return mapDioError(error);
}

AppFailure mapDeliveryOtpFailure(String code, Object? details) {
  final remaining = remainingOtpAttempts(details);
  if (code == 'OTP_ATTEMPTS_EXHAUSTED' || remaining == 0) {
    return const ValidationFailure('delivery.otp_attempts_exhausted');
  }
  return ValidationFailure(
    'delivery.otp_incorrect',
    {'remaining': '${remaining ?? 0}'},
  );
}

int? remainingOtpAttempts(Object? details) {
  if (details is! Map) return null;
  final value = details['remainingAttempts'];
  if (value is int) return value;
  if (value is num) return value.toInt();
  return null;
}
