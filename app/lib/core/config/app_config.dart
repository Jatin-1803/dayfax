import 'package:flutter/foundation.dart';

enum AppEnvironment { development, staging, production }

class AppConfig {
  const AppConfig({
    required this.environment,
    required this.apiBaseUrl,
  });

  static const localApiBaseUrl = 'http://10.0.2.2:3000/api/v1';
  static const liveApiBaseUrl = 'https://backend.dayfax.in/api/v1';

  final AppEnvironment environment;
  final String apiBaseUrl;

  /// Defaults:
  /// - debug / profile → local backend (`10.0.2.2`)
  /// - release → live backend (`backend.dayfax.in`)
  ///
  /// Overrides (optional):
  /// `--dart-define=ENV=production|staging|development`
  /// `--dart-define=API_BASE_URL=http://192.168.x.x:3000/api/v1`
  static AppConfig fromEnvironment() {
    const envName = String.fromEnvironment('ENV');
    const apiOverride = String.fromEnvironment('API_BASE_URL');

    final environment = switch (envName) {
      'production' => AppEnvironment.production,
      'staging' => AppEnvironment.staging,
      'development' => AppEnvironment.development,
      _ => kReleaseMode
          ? AppEnvironment.production
          : AppEnvironment.development,
    };

    final apiBaseUrl = apiOverride.isNotEmpty
        ? apiOverride
        : switch (environment) {
            AppEnvironment.production || AppEnvironment.staging =>
              liveApiBaseUrl,
            AppEnvironment.development => localApiBaseUrl,
          };

    return AppConfig(environment: environment, apiBaseUrl: apiBaseUrl);
  }

  bool get isDevelopment => environment == AppEnvironment.development;
  bool get isProduction => environment == AppEnvironment.production;
}
