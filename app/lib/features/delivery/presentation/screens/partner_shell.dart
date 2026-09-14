import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../delivery_view_models.dart';
import '../widgets/partner_bottom_nav.dart';

class PartnerShell extends ConsumerWidget {
  const PartnerShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _onTap(WidgetRef ref, int index) {
    // Jobs / History stay mounted in the shell — drop cached lists so Pending
    // is not stuck empty after new orders arrive while the partner was elsewhere.
    if (index == 1 || index == 2) {
      ref.invalidate(deliveryJobsListProvider);
    }
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: PartnerBottomNav(
        currentIndex: navigationShell.currentIndex,
        onTap: (index) => _onTap(ref, index),
      ),
    );
  }
}
