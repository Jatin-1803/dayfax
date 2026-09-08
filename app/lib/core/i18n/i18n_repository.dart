import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_locale.dart';

class I18nBundle {
  const I18nBundle({
    required this.version,
    required this.lang,
    required this.strings,
  });

  final int version;
  final AppLocale lang;
  final Map<String, String> strings;

  String translate(String key, [Map<String, String>? params]) {
    var value = strings[key];
    if (value == null || value.isEmpty) {
      return key;
    }
    if (params != null) {
      params.forEach((paramKey, paramValue) {
        value = value!.replaceAll('{$paramKey}', paramValue);
      });
    }
    return value!;
  }
}

class I18nRepository {
  I18nRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  static const _localeKey = 'app_locale';
  static String _versionKey(AppLocale lang) => 'i18n_version_${lang.code}';
  static String _bundleKey(AppLocale lang) => 'i18n_bundle_${lang.code}';

  Future<AppLocale> readLocale() async {
    final prefs = await SharedPreferences.getInstance();
    return AppLocale.fromCode(prefs.getString(_localeKey));
  }

  Future<void> saveLocale(AppLocale locale) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_localeKey, locale.code);
  }

  Future<I18nBundle> loadCachedOrAsset(AppLocale lang) async {
    final asset = await _loadAsset(lang);
    final prefs = await SharedPreferences.getInstance();
    final cachedJson = prefs.getString(_bundleKey(lang));
    final cachedVersion = prefs.getInt(_versionKey(lang)) ?? 0;

    if (cachedJson != null && cachedJson.isNotEmpty) {
      try {
        final map = jsonDecode(cachedJson) as Map<String, dynamic>;
        final cached = map.map((k, v) => MapEntry(k, v.toString()));
        // Asset keys fill gaps so a stale/incomplete cache never shows raw keys.
        return I18nBundle(
          version: cachedVersion,
          lang: lang,
          strings: {...asset, ...cached},
        );
      } catch (_) {
        // Fall through to asset.
      }
    }

    return I18nBundle(version: 0, lang: lang, strings: asset);
  }

  Future<Map<String, String>> _loadAsset(AppLocale lang) async {
    final raw = await rootBundle.loadString('assets/i18n/${lang.code}.json');
    final map = jsonDecode(raw) as Map<String, dynamic>;
    return map.map((k, v) => MapEntry(k, v.toString()));
  }

  /// Fetches remote bundle only when server version is newer than cache.
  /// Merges remote over asset so missing DB keys never wipe local fallbacks.
  Future<I18nBundle?> syncIfNeeded(AppLocale lang, int localVersion) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/i18n/bundle',
        queryParameters: {'lang': lang.code},
      );
      final body = response.data;
      if (body == null || body['success'] != true) return null;
      final data = body['data'] as Map<String, dynamic>;
      final version = (data['version'] as num?)?.toInt() ?? 0;
      if (version <= localVersion && localVersion > 0) {
        return null;
      }
      final stringsJson = data['strings'] as Map<String, dynamic>? ?? {};
      final remote = stringsJson.map((k, v) => MapEntry(k, v.toString()));
      if (remote.isEmpty) return null;

      final asset = await _loadAsset(lang);
      final merged = {...asset, ...remote};

      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt(_versionKey(lang), version);
      await prefs.setString(_bundleKey(lang), jsonEncode(merged));

      return I18nBundle(version: version, lang: lang, strings: merged);
    } catch (_) {
      return null;
    }
  }
}
