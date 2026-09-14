import 'package:dio/dio.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';
import '../domain/auth_models.dart';

class AuthRepository {
  AuthRepository({
    required Dio dio,
    required TokenStorage tokenStorage,
  })  : _dio = dio,
        _tokenStorage = tokenStorage;

  final Dio _dio;
  final TokenStorage _tokenStorage;

  Future<Map<String, dynamic>> requestOtp({
    required String phone,
    String phoneCountryCode = '+91',
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/otp/request',
        data: {
          'phone': phone,
          'phoneCountryCode': phoneCountryCode,
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return body['data'] as Map<String, dynamic>;
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<AuthSession> verifyOtp({
    required String phone,
    required String otp,
    String phoneCountryCode = '+91',
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/otp/verify',
        data: {
          'phone': phone,
          'phoneCountryCode': phoneCountryCode,
          'otp': otp,
        },
      );
      return _parseAndStoreSession(response.data);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<AuthSession> loginWithPassword({
    required String phone,
    required String password,
    String phoneCountryCode = '+91',
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/password/login',
        data: {
          'phone': phone,
          'phoneCountryCode': phoneCountryCode,
          'password': password,
        },
      );
      return _parseAndStoreSession(response.data);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<bool> passwordStatus({
    required String phone,
    String phoneCountryCode = '+91',
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/password/status',
        data: {
          'phone': phone,
          'phoneCountryCode': phoneCountryCode,
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      final data = body['data'] as Map<String, dynamic>;
      return data['hasPassword'] == true;
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<AuthSession> registerWithPassword({
    required String phone,
    required String password,
    required String confirmPassword,
    String phoneCountryCode = '+91',
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/password/register',
        data: {
          'phone': phone,
          'phoneCountryCode': phoneCountryCode,
          'password': password,
          'confirmPassword': confirmPassword,
        },
      );
      return _parseAndStoreSession(response.data);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<AuthSession> loginWithGoogle({required String idToken}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/google',
        data: {'idToken': idToken},
      );
      return _parseAndStoreSession(response.data);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<Map<String, dynamic>> requestLinkPhone({
    required String phone,
    String phoneCountryCode = '+91',
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/phone/link/request',
        data: {
          'phone': phone,
          'phoneCountryCode': phoneCountryCode,
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return body['data'] as Map<String, dynamic>;
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<AuthUser> verifyLinkPhone({
    required String phone,
    required String otp,
    String phoneCountryCode = '+91',
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/phone/link/verify',
        data: {
          'phone': phone,
          'phoneCountryCode': phoneCountryCode,
          'otp': otp,
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return AuthUser.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<AuthUser> linkPhoneDirect({
    required String phone,
    String phoneCountryCode = '+91',
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/phone/link',
        data: {
          'phone': phone,
          'phoneCountryCode': phoneCountryCode,
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return AuthUser.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<AuthUser> fetchMe() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/auth/me');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return AuthUser.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<AuthUser> updateProfile({required String fullName}) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/auth/me',
        data: {'fullName': fullName},
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return AuthUser.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<void> setPassword({
    required String password,
    required String confirmPassword,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/password',
        data: {
          'password': password,
          'confirmPassword': confirmPassword,
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<void> changePassword({
    required String currentPassword,
    required String password,
    required String confirmPassword,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/password/change',
        data: {
          'currentPassword': currentPassword,
          'password': password,
          'confirmPassword': confirmPassword,
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<void> logout() => _tokenStorage.clear();

  Future<bool> hasSession() => _tokenStorage.hasSession();

  Future<AuthSession> _parseAndStoreSession(Map<String, dynamic>? body) async {
    if (body == null || body['success'] != true) {
      throw const ServerFailure();
    }
    final data = body['data'] as Map<String, dynamic>;
    final session = AuthSession(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
      user: AuthUser.fromJson(data['user'] as Map<String, dynamic>),
      isNewUser: data['isNewUser'] == true,
    );
    await _tokenStorage.saveTokens(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    );
    return session;
  }
}
