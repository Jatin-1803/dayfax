import 'package:dio/dio.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/network/api_client.dart';
import '../domain/support_models.dart';

class SupportRepository {
  SupportRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<SupportThread> open(String idOrNumber, {required String lang}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/support/orders/$idOrNumber/conversations',
        data: {'lang': lang},
      );
      return _parse(response.data);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<SupportThread> get(String idOrNumber) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/support/orders/$idOrNumber/conversations',
      );
      return _parse(response.data);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<String> uploadDamagePhoto(String filePath) async {
    try {
      final form = FormData.fromMap({
        'file': await MultipartFile.fromFile(filePath),
      });
      final response = await _dio.post<Map<String, dynamic>>(
        '/support/uploads/damage-photo',
        data: form,
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      final data = body['data'] as Map<String, dynamic>? ?? const {};
      final imageUrl = data['imageUrl'] as String? ?? '';
      if (imageUrl.isEmpty) throw const ServerFailure();
      return imageUrl;
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<SupportThread> send(String idOrNumber, {required String body, required String lang}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/support/orders/$idOrNumber/messages',
        data: {'body': body, 'lang': lang},
      );
      return _parse(response.data);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<SupportThread> reportDamaged(
    String idOrNumber, {
    required String customerNote,
    required List<Map<String, dynamic>> items,
    required List<String> photoUrls,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/support/orders/$idOrNumber/returns',
        data: {'customerNote': customerNote, 'items': items, 'photoUrls': photoUrls},
      );
      return _parse(response.data);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  SupportThread _parse(Map<String, dynamic>? body) {
    if (body == null || body['success'] != true) {
      throw const ServerFailure();
    }
    return SupportThread.fromJson(body['data'] as Map<String, dynamic>);
  }
}
