import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/delivery/delivery_colors.dart';
import '../../../../core/theme/delivery/delivery_radius.dart';

class PartnerBottomNav extends ConsumerWidget {
  const PartnerBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      decoration: BoxDecoration(
        color: DeliveryColors.surfaceContainerLowest,
        border: const Border(
          top: BorderSide(color: DeliveryColors.cardBorder),
        ),
        boxShadow: [
          BoxShadow(
            color: DeliveryColors.deepSlate.withValues(alpha: 0.04),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _PartnerNavItem(
                icon: Icons.home_outlined,
                activeIcon: Icons.home,
                label: ref.t('delivery.nav.home'),
                selected: currentIndex == 0,
                onTap: () => onTap(0),
              ),
              _PartnerNavItem(
                icon: Icons.local_shipping_outlined,
                activeIcon: Icons.local_shipping,
                label: ref.t('delivery.nav.deliveries'),
                selected: currentIndex == 1,
                onTap: () => onTap(1),
              ),
              _PartnerNavItem(
                icon: Icons.history_outlined,
                activeIcon: Icons.history,
                label: ref.t('delivery.nav.history'),
                selected: currentIndex == 2,
                onTap: () => onTap(2),
              ),
              _PartnerNavItem(
                icon: Icons.person_outline,
                activeIcon: Icons.person,
                label: ref.t('delivery.nav.account'),
                selected: currentIndex == 3,
                onTap: () => onTap(3),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PartnerNavItem extends StatelessWidget {
  const _PartnerNavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? DeliveryColors.primary : DeliveryColors.onSurfaceVariant;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(DeliveryRadius.md),
      child: SizedBox(
        width: 72,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(selected ? activeIcon : icon, color: color, size: 22),
            const SizedBox(height: 4),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: color,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
