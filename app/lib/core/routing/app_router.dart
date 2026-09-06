import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/auth_view_model.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/otp_screen.dart';
import '../../features/catalog/presentation/screens/categories_screen.dart';
import '../../features/catalog/presentation/screens/category_products_screen.dart';
import '../../features/catalog/presentation/screens/product_detail_screen.dart';
import '../../features/catalog/presentation/screens/search_screen.dart';
import '../../features/delivery/presentation/screens/delivery_home_screen.dart';
import '../../features/home/presentation/screens/home_screen.dart';
import '../../features/home/presentation/screens/main_shell.dart';
import '../../shared/widgets/placeholder_tab_screen.dart';
import '../theme/app_theme.dart';
import 'auth_gate.dart';

export 'auth_gate.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();

String homePathForRole(AppRole role) {
  return switch (role) {
    AppRole.customer => '/home',
    AppRole.deliveryPartner => '/partner/home',
  };
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final authGate = ValueNotifier<int>(0);

  ref.listen<bool?>(isAuthenticatedProvider, (_, _) {
    authGate.value++;
  });

  ref.listen<AppRole>(appRoleProvider, (_, _) {
    authGate.value++;
  });

  ref.listen(sessionBootstrapProvider, (previous, next) {
    next.whenData((hasSession) {
      final current = ref.read(isAuthenticatedProvider);
      if (current == null) {
        ref.read(isAuthenticatedProvider.notifier).state = hasSession;
      }
    });
  });

  ref.onDispose(authGate.dispose);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/home',
    refreshListenable: authGate,
    redirect: (context, state) {
      final loggingIn =
          state.matchedLocation == '/login' || state.matchedLocation == '/otp';
      final isAuthenticated = ref.read(isAuthenticatedProvider);
      final role = ref.read(appRoleProvider);
      final loc = state.matchedLocation;
      final onPartner = loc.startsWith('/partner');

      if (isAuthenticated == null) return null;

      if (!isAuthenticated && !loggingIn) return '/login';
      if (isAuthenticated && loggingIn) return homePathForRole(role);

      if (isAuthenticated && role.isDeliveryPartner && !onPartner && !loggingIn) {
        return '/partner/home';
      }
      if (isAuthenticated && role.isCustomer && onPartner) {
        return '/home';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/otp',
        builder: (context, state) {
          final phone = state.extra as String? ?? '';
          return OtpScreen(phone: phone);
        },
      ),
      GoRoute(
        path: '/partner/home',
        builder: (context, state) => const DeliveryHomeScreen(),
      ),
      GoRoute(
        path: '/search',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const SearchScreen(),
      ),
      GoRoute(
        path: '/category/:slug',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) {
          final slug = state.pathParameters['slug'] ?? '';
          return CategoryProductsScreen(categorySlug: slug);
        },
      ),
      GoRoute(
        path: '/products/:idOrSlug',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) {
          final idOrSlug = state.pathParameters['idOrSlug'] ?? '';
          return ProductDetailScreen(idOrSlug: idOrSlug);
        },
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return MainShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/categories',
                builder: (context, state) => const CategoriesScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/orders',
                builder: (context, state) => const PlaceholderTabScreen(
                  title: 'Orders',
                  message: 'Order history lands in Phase 4.',
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/cart',
                builder: (context, state) => const PlaceholderTabScreen(
                  title: 'Cart',
                  message: 'Server cart lands in Phase 3.',
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                builder: (context, state) => const PlaceholderTabScreen(
                  title: 'Profile',
                  message: 'Profile management lands with addresses in Phase 3.',
                ),
              ),
            ],
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => const Scaffold(
      body: Center(child: Text('Page not found')),
    ),
  );
});
