import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/routing/app_router.dart';
import 'core/theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: DailyfaxApp()));
}

class DailyfaxApp extends ConsumerWidget {
  const DailyfaxApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    final role = ref.watch(appRoleProvider);

    return MaterialApp.router(
      title: 'Dailyfax',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.forRole(role),
      routerConfig: router,
    );
  }
}
