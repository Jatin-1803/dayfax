import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';
import 'app_locale.dart';
import 'i18n_repository.dart';

final i18nRepositoryProvider = Provider<I18nRepository>((ref) {
  return I18nRepository(dio: ref.watch(dioProvider));
});

class LocaleController extends AsyncNotifier<AppLocale> {
  @override
  Future<AppLocale> build() async {
    final repo = ref.read(i18nRepositoryProvider);
    return repo.readLocale();
  }

  Future<void> setLocale(AppLocale locale) async {
    final repo = ref.read(i18nRepositoryProvider);
    await repo.saveLocale(locale);
    state = AsyncData(locale);
    await ref.read(i18nBundleProvider.notifier).reload(locale);
  }
}

final localeControllerProvider =
    AsyncNotifierProvider<LocaleController, AppLocale>(LocaleController.new);

class I18nBundleController extends AsyncNotifier<I18nBundle> {
  @override
  Future<I18nBundle> build() async {
    final locale = await ref.watch(localeControllerProvider.future);
    final repo = ref.read(i18nRepositoryProvider);
    final local = await repo.loadCachedOrAsset(locale);
    // Fire-and-forget remote sync — UI uses local/cache immediately.
    Future.microtask(() => _sync(locale, local.version));
    return local;
  }

  Future<void> reload(AppLocale locale) async {
    final repo = ref.read(i18nRepositoryProvider);
    final local = await repo.loadCachedOrAsset(locale);
    state = AsyncData(local);
    await _sync(locale, local.version);
  }

  Future<void> _sync(AppLocale locale, int localVersion) async {
    final repo = ref.read(i18nRepositoryProvider);
    final updated = await repo.syncIfNeeded(locale, localVersion);
    if (updated != null) {
      state = AsyncData(updated);
    }
  }
}

final i18nBundleProvider =
    AsyncNotifierProvider<I18nBundleController, I18nBundle>(I18nBundleController.new);

/// Current locale code for API `lang` query (defaults to en while loading).
final appLangCodeProvider = Provider<String>((ref) {
  return ref.watch(localeControllerProvider).valueOrNull?.code ?? AppLocale.en.code;
});

extension I18nContextX on BuildContext {
  String t(String key, [Map<String, String>? params]) {
    final container = ProviderScope.containerOf(this, listen: false);
    final bundle = container.read(i18nBundleProvider).valueOrNull;
    if (bundle == null) return key;
    final value = bundle.translate(key, params);
    if (value == key) {
      // English fallback when active locale is missing a key.
      return key;
    }
    return value;
  }
}

extension I18nRefX on WidgetRef {
  String t(String key, [Map<String, String>? params]) {
    final bundle = watch(i18nBundleProvider).valueOrNull;
    if (bundle == null) return key;
    return bundle.translate(key, params);
  }

  String tr(String key, [Map<String, String>? params]) {
    final bundle = read(i18nBundleProvider).valueOrNull;
    if (bundle == null) return key;
    return bundle.translate(key, params);
  }
}
