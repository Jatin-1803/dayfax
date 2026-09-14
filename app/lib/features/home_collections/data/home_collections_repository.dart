import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/network/api_client.dart';
import '../domain/home_collection_models.dart';

final homeCollectionsRepositoryProvider = Provider<HomeCollectionsRepository>((ref) {
  return HomeCollectionsRepository(dio: ref.watch(dioProvider));
});

class HomeCollectionsRepository {
  HomeCollectionsRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<HomeCollection?> getActive({String lang = 'en'}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/home-collections/active',
        queryParameters: {'lang': lang},
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      final data = body['data'];
      if (data is! Map<String, dynamic>) {
        throw const ServerFailure('Unexpected home collection response.');
      }
      final collection = data['collection'];
      if (collection == null) return null;
      if (collection is! Map<String, dynamic>) {
        throw const ServerFailure('Unexpected home collection response.');
      }
      final parsed = HomeCollection.fromJson(collection);
      if (parsed.headline.trim().isEmpty || parsed.products.isEmpty) return null;
      return parsed;
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }
}
