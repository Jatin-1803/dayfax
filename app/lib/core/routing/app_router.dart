import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/addresses/domain/address_models.dart';
import '../../features/addresses/presentation/screens/addresses_screen.dart';
import '../../features/auth/presentation/auth_view_model.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/otp_screen.dart';
import '../../features/auth/presentation/screens/partner_login_screen.dart';
import '../../features/auth/presentation/screens/partner_otp_screen.dart';
import '../../features/cart/presentation/screens/cart_screen.dart';
import '../../features/catalog/presentation/screens/categories_screen.dart';
import '../../features/catalog/presentation/screens/category_products_screen.dart';
import '../../features/catalog/presentation/screens/product_detail_screen.dart';
import '../../features/catalog/presentation/screens/search_screen.dart';
import '../../features/delivery/presentation/screens/deliveries_list_screen.dart';
import '../../features/delivery/presentation/screens/delivery_detail_screen.dart';
import '../../features/delivery/presentation/screens/delivery_home_screen.dart';
import '../../features/delivery/presentation/screens/delivery_success_screen.dart';
import '../../features/delivery/presentation/screens/partner_account_screen.dart';
import '../../features/delivery/presentation/screens/partner_shell.dart';
import '../../features/home/presentation/screens/home_screen.dart';
import '../../features/home/presentation/screens/main_shell.dart';
import '../../features/home/presentation/screens/profile_screen.dart';
import '../../features/notifications/presentation/screens/notifications_screen.dart';
import '../../features/orders/presentation/screens/checkout_screen.dart';
import '../../features/orders/presentation/screens/order_confirmed_screen.dart';
import '../../features/orders/presentation/screens/order_detail_screen.dart';
import '../../features/orders/presentation/screens/orders_screen.dart';
import '../../features/orders/presentation/screens/track_order_screen.dart';
import '../i18n/i18n_providers.dart';
import '../../features/shops/presentation/screens/shop_detail_screen.dart';
import '../../features/shops/presentation/screens/shops_list_screen.dart';
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

bool _isAuthRoute(String loc) {
  return loc == '/login' ||
      loc == '/otp' ||
      loc == '/partner/login' ||
      loc == '/partner/otp';
}

bool _isPartnerAuthRoute(String loc) {
  return loc == '/partner/login' || loc == '/partner/otp';
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
      final loc = state.matchedLocation;
      final loggingIn = _isAuthRoute(loc);
      final partnerAuth = _isPartnerAuthRoute(loc);
      final isAuthenticated = ref.read(isAuthenticatedProvider);
      final role = ref.read(appRoleProvider);
      final onPartner = loc.startsWith('/partner');

      if (isAuthenticated == null) return null;

      if (!isAuthenticated && !loggingIn) {
        return '/login';
      }

      if (isAuthenticated && loggingIn) {
        return homePathForRole(role);
      }

      if (isAuthenticated && role.isDeliveryPartner && !onPartner && !loggingIn) {
        return '/partner/home';
      }
      if (isAuthenticated && role.isCustomer && onPartner && !partnerAuth) {
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
        path: '/partner/login',
        builder: (context, state) => const PartnerLoginScreen(),
      ),
      GoRoute(
        path: '/partner/otp',
        builder: (context, state) {
          final phone = state.extra as String? ?? '';
          return PartnerOtpScreen(phone: phone);
        },
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return PartnerShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/partner/home',
                builder: (context, state) => const DeliveryHomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/partner/jobs',
                builder: (context, state) {
                  final tab = state.uri.queryParameters['tab'];
                  return DeliveriesListScreen(initialTab: tab);
                },
                routes: [
                  GoRoute(
                    path: ':idOrOrderId',
                    builder: (context, state) {
                      final id = state.pathParameters['idOrOrderId'] ?? '';
                      return DeliveryDetailScreen(idOrOrderId: id);
                    },
                    routes: [
                      GoRoute(
                        path: 'success',
                        builder: (context, state) {
                          final id = state.pathParameters['idOrOrderId'] ?? '';
                          return DeliverySuccessScreen(idOrOrderId: id);
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/partner/history',
                builder: (context, state) =>
                    const DeliveriesListScreen(initialTab: 'completed'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/partner/account',
                builder: (context, state) => const PartnerAccountScreen(),
              ),
            ],
          ),
        ],
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
              GoRoute(
                path: '/search',
                builder: (context, state) => const SearchScreen(),
              ),
              GoRoute(
                path: '/shops',
                builder: (context, state) => const ShopsListScreen(),
                routes: [
                  GoRoute(
                    path: ':idOrSlug',
                    builder: (context, state) {
                      final idOrSlug = state.pathParameters['idOrSlug'] ?? '';
                      return ShopDetailScreen(idOrSlug: idOrSlug);
                    },
                  ),
                ],
              ),
              GoRoute(
                path: '/products/:idOrSlug',
                builder: (context, state) {
                  final idOrSlug = state.pathParameters['idOrSlug'] ?? '';
                  return ProductDetailScreen(idOrSlug: idOrSlug);
                },
              ),
              GoRoute(
                path: '/notifications',
                builder: (context, state) => const NotificationsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/categories',
                builder: (context, state) => const CategoriesScreen(),
              ),
              GoRoute(
                path: '/category/:slug',
                builder: (context, state) {
                  final slug = state.pathParameters['slug'] ?? '';
                  return CategoryProductsScreen(categorySlug: slug);
                },
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/orders',
                builder: (context, state) => const OrdersScreen(),
                routes: [
                  GoRoute(
                    path: ':idOrNumber',
                    builder: (context, state) {
                      final id = state.pathParameters['idOrNumber'] ?? '';
                      return OrderDetailScreen(idOrNumber: id);
                    },
                    routes: [
                      GoRoute(
                        path: 'confirmed',
                        builder: (context, state) {
                          final id = state.pathParameters['idOrNumber'] ?? '';
                          return OrderConfirmedScreen(idOrNumber: id);
                        },
                      ),
                      GoRoute(
                        path: 'track',
                        builder: (context, state) {
                          final id = state.pathParameters['idOrNumber'] ?? '';
                          return TrackOrderScreen(idOrNumber: id);
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/cart',
                builder: (context, state) => const CartScreen(),
              ),
              GoRoute(
                path: '/checkout',
                builder: (context, state) => const CheckoutScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                builder: (context, state) => const ProfileScreen(),
              ),
              GoRoute(
                path: '/addresses/edit',
                builder: (context, state) {
                  if (state.extra is UserAddress) {
                    return AddressEditScreen(initial: state.extra as UserAddress);
                  }
                  if (state.extra is AddressDraft) {
                    return AddressEditScreen(prefill: state.extra as AddressDraft);
                  }
                  return const AddressEditScreen();
                },
              ),
              GoRoute(
                path: '/addresses',
                builder: (context, state) => const AddressesScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(child: Text(context.t('nav.page_not_found'))),
    ),
  );
});
