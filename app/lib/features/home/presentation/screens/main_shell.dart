import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/widgets/app_bottom_nav.dart';
import '../../../cart/presentation/cart_view_model.dart';
import '../../../orders/presentation/orders_view_models.dart';

class MainShell extends ConsumerWidget {
  const MainShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const _ordersTabIndex = 2;

  void _onTap(WidgetRef ref, int index) {
    if (index == _ordersTabIndex) {
      ref.read(ordersListViewModelProvider.notifier).load(reset: true, silent: true);
    }
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartCount = ref.watch(cartItemCountProvider);

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: AppBottomNav(
        currentIndex: navigationShell.currentIndex,
        cartCount: cartCount > 99 ? 99 : cartCount,
        onTap: (index) => _onTap(ref, index),
      ),
    );
  }
}
