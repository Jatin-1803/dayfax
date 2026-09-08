import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/i18n/app_locale.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/routing/auth_gate.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../auth/presentation/auth_view_model.dart';
import '../../../notifications/presentation/notifications_view_model.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(notificationsUnreadCountProvider);
    final locale = ref.watch(localeControllerProvider).valueOrNull ?? AppLocale.en;

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('profile.title'))),
      body: ListView(
        padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
        children: [
          Container(
            padding: const EdgeInsets.all(CustomerSpacing.lg),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  CustomerColors.primaryContainer.withValues(alpha: 0.35),
                  CustomerColors.surfaceContainerLowest,
                ],
              ),
              borderRadius: BorderRadius.circular(CustomerRadius.md),
              border: Border.all(
                color: CustomerColors.primaryContainer.withValues(alpha: 0.45),
              ),
            ),
            child: Row(
              children: [
                const CircleAvatar(
                  radius: 28,
                  backgroundColor: CustomerColors.primaryContainer,
                  child: Icon(Icons.person, size: 28, color: CustomerColors.onPrimaryContainer),
                ),
                const SizedBox(width: CustomerSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        ref.t('profile.customer_title'),
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        ref.t('profile.customer_subtitle'),
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: CustomerColors.onSurfaceVariant,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: CustomerSpacing.lg),
          Text(ref.t('common.language'), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: CustomerSpacing.sm),
          SegmentedButton<AppLocale>(
            segments: [
              ButtonSegment(
                value: AppLocale.en,
                label: Text(ref.t('common.language_en')),
                icon: const Icon(Icons.language, size: 18),
              ),
              ButtonSegment(
                value: AppLocale.hi,
                label: Text(ref.t('common.language_hi')),
                icon: const Icon(Icons.translate, size: 18),
              ),
            ],
            selected: {locale},
            onSelectionChanged: (selected) {
              final next = selected.first;
              ref.read(localeControllerProvider.notifier).setLocale(next);
            },
          ),
          const SizedBox(height: CustomerSpacing.xs),
          Text(
            ref.t('common.choose_language'),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: CustomerColors.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: CustomerSpacing.lg),
          Text(ref.t('profile.quick_actions'), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: CustomerSpacing.sm),
          _ProfileTile(
            icon: Icons.receipt_long_outlined,
            title: ref.t('profile.your_orders'),
            subtitle: ref.t('profile.track_reorder'),
            onTap: () => context.go('/orders'),
          ),
          _ProfileTile(
            icon: Icons.location_on_outlined,
            title: ref.t('profile.saved_addresses'),
            subtitle: ref.t('profile.delivery_locations'),
            onTap: () => context.push('/addresses'),
          ),
          _ProfileTile(
            icon: Icons.notifications_outlined,
            title: ref.t('profile.notifications'),
            subtitle: unread > 0
                ? ref.t('profile.unread_count', {'count': '$unread'})
                : ref.t('profile.order_updates'),
            badge: unread > 0,
            onTap: () => context.push('/notifications'),
          ),
          _ProfileTile(
            icon: Icons.shopping_cart_outlined,
            title: ref.t('profile.your_cart'),
            subtitle: ref.t('profile.review_items'),
            onTap: () => context.go('/cart'),
          ),
          const SizedBox(height: CustomerSpacing.lg),
          Text(ref.t('profile.support'), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: CustomerSpacing.sm),
          _ProfileTile(
            icon: Icons.help_outline,
            title: ref.t('profile.help'),
            subtitle: ref.t('profile.help_subtitle'),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(ref.t('profile.help_snackbar'))),
              );
            },
          ),
          const SizedBox(height: CustomerSpacing.xl),
          AppButton(
            label: ref.t('common.log_out'),
            variant: AppButtonVariant.outline,
            onPressed: () async {
              await ref.read(authRepositoryProvider).logout();
              ref.read(isAuthenticatedProvider.notifier).state = false;
              ref.read(appRoleProvider.notifier).state = AppRole.customer;
              ref.invalidate(sessionBootstrapProvider);
              if (context.mounted) context.go('/login');
            },
          ),
        ],
      ),
    );
  }
}

class _ProfileTile extends StatelessWidget {
  const _ProfileTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.badge = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final bool badge;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: CustomerSpacing.sm),
      child: Material(
        color: CustomerColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(CustomerRadius.md),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(CustomerRadius.md),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(CustomerRadius.md),
              border: Border.all(
                color: CustomerColors.outlineVariant.withValues(alpha: 0.3),
              ),
            ),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: CustomerColors.surfaceContainer,
                child: Icon(icon, color: CustomerColors.primary, size: 22),
              ),
              title: Text(
                title,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              subtitle: Text(subtitle),
              trailing: badge
                  ? const Badge(smallSize: 8, child: Icon(Icons.chevron_right))
                  : const Icon(Icons.chevron_right),
            ),
          ),
        ),
      ),
    );
  }
}
