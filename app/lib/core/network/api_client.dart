import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app_controls/app_block.dart';
import '../app_controls/client_headers.dart';
import '../config/app_config.dart';
import '../errors/app_failure.dart';
import '../routing/auth_gate.dart';
import '../storage/token_storage.dart';

final appConfigProvider = Provider<AppConfig>((ref) => AppConfig.fromEnvironment());

final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());

final dioProvider = Provider<Dio>((ref) {
  final config = ref.watch(appConfigProvider);
  final tokenStorage = ref.watch(tokenStorageProvider);
  final headers = ClientHeaders();

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

  Future<_RefreshOutcome>? refreshInFlight;

  Future<_RefreshOutcome> tryRefreshTokens() async {
    final refreshToken = await tokenStorage.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      return _RefreshOutcome.unauthenticated;
    }

    try {
      final response = await refreshDio.post<Map<String, dynamic>>(
        '/auth/token/refresh',
        data: {'refreshToken': refreshToken},
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        return _RefreshOutcome.unauthenticated;
      }
      final data = body['data'] as Map<String, dynamic>;
      final access = data['accessToken'] as String?;
      final refresh = data['refreshToken'] as String?;
      if (access == null || refresh == null) {
        return _RefreshOutcome.unauthenticated;
      }
      await tokenStorage.saveTokens(accessToken: access, refreshToken: refresh);
      return _RefreshOutcome.refreshed;
    } on DioException catch (error) {
      final status = error.response?.statusCode;
      if (status == 401 || status == 403) {
        final current = await tokenStorage.readRefreshToken();
        if (current != null && current.isNotEmpty && current != refreshToken) {
          return _RefreshOutcome.refreshed;
        }
        return _RefreshOutcome.unauthenticated;
      }
      return _RefreshOutcome.transient;
    } catch (_) {
      return _RefreshOutcome.transient;
    }
  }

  Future<_RefreshOutcome> refreshOnce() async {
    final inFlight = refreshInFlight;
    if (inFlight != null) {
      return inFlight;
    }
    final pending = tryRefreshTokens();
    refreshInFlight = pending;
    try {
      return await pending;
    } finally {
      if (identical(refreshInFlight, pending)) {
        refreshInFlight = null;
      }
    }
  }

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final path = options.path;
        if (!path.contains('/auth/token/refresh') && !path.contains('/auth/otp/')) {
          final current = await tokenStorage.readAccessToken();
          final refresh = await tokenStorage.readRefreshToken();
          final missingAccess = current == null || current.isEmpty;
          final hasRefresh = refresh != null && refresh.isNotEmpty;
          if ((missingAccess && hasRefresh) || _accessTokenNeedsRefresh(current)) {
            final outcome = await refreshOnce();
            if (outcome == _RefreshOutcome.unauthenticated) {
              await tokenStorage.clear();
              ref.read(isAuthenticatedProvider.notifier).state = false;
            }
          }
        }
        final token = await tokenStorage.readAccessToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        options.headers.addAll(await headers.build());
        handler.next(options);
      },
      onError: (error, handler) async {
        final status = error.response?.statusCode;
        final path = error.requestOptions.path;
        final alreadyRetried = error.requestOptions.extra['authRetried'] == true;
        final code = readErrorCode(error.response?.data);
        final block = blockFromErrorCode(code, _extractMessage(error.response?.data));
        if (block != null && code != 'TOKEN_EXPIRED') {
          ref.read(appBlockProvider.notifier).state = block;
        }

        if (status != 401 || alreadyRetried || path.contains('/auth/token/refresh')) {
          handler.next(error);
          return;
        }

        final refreshed = await refreshOnce();
        if (refreshed == _RefreshOutcome.transient) {
          handler.next(error);
          return;
        }
        if (refreshed != _RefreshOutcome.refreshed) {
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
      final message = _friendlyErrorKey(readErrorCode(error.response?.data)) ??
          _extractMessage(error.response?.data);
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

enum _RefreshOutcome { refreshed, unauthenticated, transient }

bool _accessTokenNeedsRefresh(String? token) {
  if (token == null || token.isEmpty) return false;
  final parts = token.split('.');
  if (parts.length < 2) return true;
  try {
    final payload = jsonDecode(
      utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
    );
    if (payload is! Map) return true;
    final exp = payload['exp'];
    if (exp is! num) return false;
    final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    return exp <= now + 90;
  } catch (_) {
    return true;
  }
}

String? _friendlyErrorKey(String? code) {
  switch (code) {
    case 'LOGIN_DISABLED':
      return 'app_gate.login_disabled';
    case 'OTP_LOGIN_DISABLED':
      return 'auth.otp_login_disabled';
    case 'OTP_LOGIN_REQUIRED':
      return 'auth.otp_login_required';
    case 'PASSWORD_NOT_SET':
      return 'auth.password_not_set';
    case 'INVALID_CREDENTIALS':
      return 'auth.invalid_credentials';
    case 'REGISTRATION_DISABLED':
      return 'app_gate.registration_disabled';
    case 'ACCOUNT_LOCKED':
      return 'app_gate.locked_message';
    case 'ACCOUNT_BANNED':
      return 'app_gate.banned_message';
    case 'ACCOUNT_SUSPENDED':
      return 'app_gate.suspended_message';
    case 'ACCOUNT_INACTIVE':
      return 'app_gate.inactive_message';
    case 'MAINTENANCE':
      return 'app_gate.maintenance_message';
    case 'UNSUPPORTED_APP_VERSION':
      return 'app_gate.update_message';
    case 'GOOGLE_AUTH_DISABLED':
      return 'auth.google_not_configured';
    case 'NO_APP_ACCESS':
      return 'auth.no_access';
    case 'PHONE_ALREADY_LINKED':
      return 'auth.phone_already_linked';
    case 'PHONE_IN_USE':
      return 'auth.phone_in_use';
    default:
      return null;
  }
}

String? _extractMessage(Object? data) {
  if (data is Map<String, dynamic>) {
    final message = data['message'];
    if (message is String && message.isNotEmpty) return message;
  }
  return null;
}
