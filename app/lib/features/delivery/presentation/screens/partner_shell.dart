import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../widgets/partner_bottom_nav.dart';

class PartnerShell extends StatelessWidget {
  const PartnerShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _onTap(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: PartnerBottomNav(
        currentIndex: navigationShell.currentIndex,
        onTap: _onTap,
      ),
    );
  }
}
