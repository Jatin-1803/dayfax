import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/network/api_client.dart';
import '../domain/address_models.dart';

final addressesRepositoryProvider = Provider<AddressesRepository>((ref) {
  return AddressesRepository(dio: ref.watch(dioProvider));
});

class AddressesRepository {
  AddressesRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<List<UserAddress>> list() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/addresses');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      final data = body['data'];
      if (data is! List) throw const ServerFailure('Unexpected addresses response.');
      return data.whereType<Map<String, dynamic>>().map(UserAddress.fromJson).toList();
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<UserAddress> create(Map<String, dynamic> payload) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>('/addresses', data: payload);
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return UserAddress.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<UserAddress> update(String id, Map<String, dynamic> payload) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>('/addresses/$id', data: payload);
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return UserAddress.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<void> delete(String id) async {
    try {
      final response = await _dio.delete<Map<String, dynamic>>('/addresses/$id');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }

  Future<UserAddress> setDefault(String id) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>('/addresses/$id/default');
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const ServerFailure();
      }
      return UserAddress.fromJson(body['data'] as Map<String, dynamic>);
    } catch (error) {
      if (error is AppFailure) rethrow;
      throw mapDioError(error);
    }
  }
}
