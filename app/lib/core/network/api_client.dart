import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../errors/app_failure.dart';
import '../routing/auth_gate.dart';
import '../storage/token_storage.dart';

final appConfigProvider = Provider<AppConfig>((ref) => AppConfig.fromEnvironment());

final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());

final dioProvider = Provider<Dio>((ref) {
  final config = ref.watch(appConfigProvider);
  final tokenStorage = ref.watch(tokenStorageProvider);

  final dio = Dio(
    BaseOptions(
      baseUrl: config.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
      headers: const {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ),
  );

  // Bare client for refresh — avoids interceptor recursion.
  final refreshDio = Dio(
    BaseOptions(
      baseUrl: config.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
      headers: const {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ),
  );

  Future<bool>? refreshInFlight;

  Future<bool> tryRefreshTokens() async {
    final refreshToken = await tokenStorage.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      return false;
    }

    try {
      final response = await refreshDio.post<Map<String, dynamic>>(
        '/auth/token/refresh',
        data: {'refreshToken': refreshToken},
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        return false;
      }
      final data = body['data'] as Map<String, dynamic>;
      final access = data['accessToken'] as String?;
      final refresh = data['refreshToken'] as String?;
      if (access == null || refresh == null) {
        return false;
      }
      await tokenStorage.saveTokens(accessToken: access, refreshToken: refresh);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> refreshOnce() async {
    if (refreshInFlight != null) {
      return refreshInFlight!;
    }
    refreshInFlight = tryRefreshTokens();
    try {
      return await refreshInFlight!;
    } finally {
      refreshInFlight = null;
    }
  }

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await tokenStorage.readAccessToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final status = error.response?.statusCode;
        final path = error.requestOptions.path;
        final alreadyRetried = error.requestOptions.extra['authRetried'] == true;

        if (status != 401 || alreadyRetried || path.contains('/auth/token/refresh')) {
          handler.next(error);
          return;
        }

        final refreshed = await refreshOnce();
        if (!refreshed) {
          await tokenStorage.clear();
          ref.read(isAuthenticatedProvider.notifier).state = false;
          handler.next(error);
          return;
        }

        try {
          final request = error.requestOptions;
          final access = await tokenStorage.readAccessToken();
          request.headers['Authorization'] = 'Bearer $access';
          request.extra['authRetried'] = true;
          final response = await dio.fetch<dynamic>(request);
          handler.resolve(response);
        } catch (retryError) {
          if (retryError is DioException) {
            handler.next(retryError);
          } else {
            handler.next(error);
          }
        }
      },
    ),
  );

  if (config.isDevelopment) {
    dio.interceptors.add(LogInterceptor(requestBody: true, responseBody: true));
  }

  return dio;
});

AppFailure mapDioError(Object error) {
  if (error is! DioException) {
    return const UnknownFailure();
  }

  switch (error.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
      return const TimeoutFailure();
    case DioExceptionType.connectionError:
      return const NetworkFailure();
    case DioExceptionType.badResponse:
      final status = error.response?.statusCode ?? 500;
      final message = _extractMessage(error.response?.data);
      if (status == 401) return UnauthorizedFailure(message ?? 'error.sign_in');
      if (status == 403) return UnauthorizedFailure(message ?? 'error.permission');
      if (status == 404) return NotFoundFailure(message ?? 'error.not_found');
      if (status == 409) return ConflictFailure(message ?? 'error.conflict');
      if (status == 422 || status == 400) {
        return ValidationFailure(message ?? 'error.check_input');
      }
      return ServerFailure(message ?? 'error.generic');
    default:
      return const UnknownFailure();
  }
}

String? _extractMessage(Object? data) {
  if (data is Map<String, dynamic>) {
    final message = data['message'];
    if (message is String && message.isNotEmpty) return message;
  }
  return null;
}
