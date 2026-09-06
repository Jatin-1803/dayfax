import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/network/api_client.dart';
import '../domain/catalog_models.dart';

final catalogRepositoryProvider = Provider<CatalogRepository>((ref) {
  return CatalogRepository(dio: ref.watch(dioProvider));
});

class CatalogRepository {
  CatalogRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<List<CatalogCategory>> listCategories({String? parentId}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/categories',
        queryParameters: {
          'parentId': ?parentId,
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      final data = body['data'];
      if (data is! List) {
        throw const ServerFailure('Unexpected categories response.');
      }
      return data
          .whereType<Map<String, dynamic>>()
          .map(CatalogCategory.fromJson)
          .toList();
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<CatalogCategory> getCategory(String idOrSlug) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/categories/$idOrSlug');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return CatalogCategory.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<ProductPage> listProducts({
    int page = 1,
    int limit = 20,
    String? categoryId,
    String? categorySlug,
    String? q,
    String? storeId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/products',
        queryParameters: {
          'page': page,
          'limit': limit,
          'categoryId': ?categoryId,
          'categorySlug': ?categorySlug,
          if (q != null && q.isNotEmpty) 'q': q,
          'storeId': ?storeId,
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return ProductPage.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<CatalogProductDetail> getProduct(
    String idOrSlug, {
    String? storeId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/products/$idOrSlug',
        queryParameters: {
          'storeId': ?storeId,
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return CatalogProductDetail.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }
}
