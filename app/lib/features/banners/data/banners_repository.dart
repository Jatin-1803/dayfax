import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/network/api_client.dart';
import '../domain/banner_models.dart';

final bannersRepositoryProvider = Provider<BannersRepository>((ref) {
  return BannersRepository(dio: ref.watch(dioProvider));
});

class BannersRepository {
  BannersRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<List<HomeBanner>> listActive({String lang = 'en'}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/banners',
        queryParameters: {'lang': lang},
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      final data = body['data'];
      if (data is! List) {
        throw const ServerFailure('Unexpected banners response.');
      }
      return data
          .whereType<Map<String, dynamic>>()
          .map(HomeBanner.fromJson)
          .where((banner) => banner.imageUrl.isNotEmpty)
          .toList();
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }
}
