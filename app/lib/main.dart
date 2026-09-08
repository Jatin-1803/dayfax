import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/i18n/app_locale.dart';
import 'core/i18n/i18n_providers.dart';
import 'core/routing/app_router.dart';
import 'core/theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: DayFaxApp()));
}

class DayFaxApp extends ConsumerWidget {
  const DayFaxApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    final role = ref.watch(appRoleProvider);
    final partnerAuthSurface = ref.watch(partnerAuthSurfaceProvider);
    final localeAsync = ref.watch(localeControllerProvider);
    final locale = localeAsync.valueOrNull ?? AppLocale.en;
    // Ensure bundle is loaded for current locale.
    ref.watch(i18nBundleProvider);

    return MaterialApp.router(
      title: 'DayFax',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.resolve(
        role: role,
        partnerAuthSurface: partnerAuthSurface,
      ),
      locale: Locale(locale.code),
      supportedLocales: AppLocale.supported.map((l) => Locale(l.code)).toList(),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      routerConfig: router,
    );
  }
}
