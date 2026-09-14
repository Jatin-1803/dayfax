import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../shared/widgets/app_button.dart';
import '../i18n/i18n_providers.dart';
import '../network/api_client.dart';
import '../routing/app_router.dart';
import '../theme/app_theme.dart';
import 'app_block.dart';
import 'app_gate.dart';

class AppBlockScreen extends ConsumerWidget {
  const AppBlockScreen({super.key, required this.block});

  final AppBlock block;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final title = block.title?.isNotEmpty == true ? block.title! : ref.t(_titleKey(block.reason));
    final message = block.message?.isNotEmpty == true ? block.message! : ref.t(_messageKey(block.reason));
    final when = _friendlyTime(block.expectedEndAt);

    return Scaffold(
      backgroundColor: CustomerColors.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(CustomerSpacing.xl),
          child: Column(
            children: [
              const Spacer(),
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  color: _tint(block.reason),
                  shape: BoxShape.circle,
                ),
                child: Icon(_icon(block.reason), size: 40, color: CustomerColors.onSurface),
              ),
              const SizedBox(height: CustomerSpacing.lg),
              Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: CustomerSpacing.md),
              Text(
                message,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: CustomerColors.onSurfaceVariant,
                    ),
              ),
              if (when != null) ...[
                const SizedBox(height: CustomerSpacing.md),
                Text(
                  ref.t('app_gate.expected_back', {'time': when}),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
              const Spacer(),
              ..._actions(context, ref),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _actions(BuildContext context, WidgetRef ref) {
    switch (block.reason) {
      case AppBlockReason.forceUpdate:
        final url = block.storeUrl;
        if (url == null || url.isEmpty) {
          return [
            Text(
              ref.t('app_gate.update_store_missing'),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ];
        }
        return [
          AppButton(
            label: ref.t('app_gate.update'),
            onPressed: () => _openStore(url),
          ),
        ];
      case AppBlockReason.maintenance:
      case AppBlockReason.serviceUnavailable:
        return [
          AppButton(
            label: ref.t('common.retry'),
            onPressed: () async {
              ref.invalidate(appBootstrapProvider);
              final next = await ref.read(appBootstrapProvider.future);
              if (next.block == null) {
                ref.read(appBlockProvider.notifier).state = null;
              }
            },
          ),
        ];
      case AppBlockReason.sessionExpired:
        return [
          AppButton(
            label: ref.t('app_gate.sign_in'),
            onPressed: () => _leaveToLogin(ref),
          ),
        ];
      case AppBlockReason.accountSuspended:
      case AppBlockReason.accountBanned:
      case AppBlockReason.accountLocked:
      case AppBlockReason.accountInactive:
        return [
          AppButton(
            label: ref.t('common.log_out'),
            variant: AppButtonVariant.outline,
            onPressed: () => _leaveToLogin(ref),
          ),
        ];
    }
  }

  Future<void> _leaveToLogin(WidgetRef ref) async {
    await ref.read(tokenStorageProvider).clear();
    ref.read(isAuthenticatedProvider.notifier).state = false;
    ref.read(appBlockProvider.notifier).state = null;
    ref.read(appRouterProvider).go('/login');
  }

  Future<void> _openStore(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

class AnnouncementBanner extends ConsumerWidget {
  const AnnouncementBanner({super.key, required this.item});

  final AppAnnouncement item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final critical = item.severity == 'CRITICAL';
    final warning = item.severity == 'WARNING';
    final background = critical
        ? CustomerColors.errorContainer
        : warning
            ? CustomerColors.secondaryContainer
            : CustomerColors.primaryContainer;
    final foreground = critical
        ? CustomerColors.onErrorContainer
        : warning
            ? CustomerColors.onSecondaryContainer
            : CustomerColors.onPrimaryContainer;

    return Material(
      color: background,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            CustomerSpacing.md,
            CustomerSpacing.sm,
            CustomerSpacing.xs,
            CustomerSpacing.sm,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                critical ? Icons.error_outline : Icons.campaign_outlined,
                size: 22,
                color: foreground,
              ),
              const SizedBox(width: CustomerSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.title, style: Theme.of(context).textTheme.titleSmall?.copyWith(color: foreground)),
                    const SizedBox(height: 2),
                    Text(item.message, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: foreground)),
                  ],
                ),
              ),
              if (item.dismissible)
                Semantics(
                  button: true,
                  label: ref.t('app_gate.dismiss'),
                  child: IconButton(
                    onPressed: () {
                      final current = ref.read(dismissedAnnouncementsProvider);
                      ref.read(dismissedAnnouncementsProvider.notifier).state = {...current, item.id};
                    },
                    icon: Icon(Icons.close, color: foreground),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

String? _friendlyTime(String? raw) {
  if (raw == null || raw.isEmpty || raw == 'null') return null;
  final parsed = DateTime.tryParse(raw);
  if (parsed == null) return null;
  return DateFormat('d MMM, h:mm a').format(parsed.toLocal());
}

String _titleKey(AppBlockReason reason) {
  switch (reason) {
    case AppBlockReason.forceUpdate:
      return 'app_gate.update_title';
    case AppBlockReason.maintenance:
      return 'app_gate.maintenance_title';
    case AppBlockReason.sessionExpired:
      return 'app_gate.session_title';
    case AppBlockReason.accountSuspended:
      return 'app_gate.suspended_title';
    case AppBlockReason.accountBanned:
      return 'app_gate.banned_title';
    case AppBlockReason.accountLocked:
      return 'app_gate.locked_title';
    case AppBlockReason.accountInactive:
      return 'app_gate.inactive_title';
    case AppBlockReason.serviceUnavailable:
      return 'app_gate.unavailable_title';
  }
}

String _messageKey(AppBlockReason reason) {
  switch (reason) {
    case AppBlockReason.forceUpdate:
      return 'app_gate.update_message';
    case AppBlockReason.maintenance:
      return 'app_gate.maintenance_message';
    case AppBlockReason.sessionExpired:
      return 'app_gate.session_message';
    case AppBlockReason.accountSuspended:
      return 'app_gate.suspended_message';
    case AppBlockReason.accountBanned:
      return 'app_gate.banned_message';
    case AppBlockReason.accountLocked:
      return 'app_gate.locked_message';
    case AppBlockReason.accountInactive:
      return 'app_gate.inactive_message';
    case AppBlockReason.serviceUnavailable:
      return 'app_gate.unavailable_message';
  }
}

IconData _icon(AppBlockReason reason) {
  switch (reason) {
    case AppBlockReason.forceUpdate:
      return Icons.system_update_alt;
    case AppBlockReason.maintenance:
      return Icons.construction_outlined;
    case AppBlockReason.sessionExpired:
      return Icons.lock_clock_outlined;
    case AppBlockReason.accountSuspended:
    case AppBlockReason.accountBanned:
    case AppBlockReason.accountLocked:
    case AppBlockReason.accountInactive:
      return Icons.no_accounts_outlined;
    case AppBlockReason.serviceUnavailable:
      return Icons.cloud_off_outlined;
  }
}

Color _tint(AppBlockReason reason) {
  switch (reason) {
    case AppBlockReason.accountBanned:
    case AppBlockReason.accountLocked:
      return CustomerColors.errorContainer;
    case AppBlockReason.maintenance:
    case AppBlockReason.accountSuspended:
      return CustomerColors.secondaryContainer;
    default:
      return CustomerColors.primaryContainer.withValues(alpha: 0.35);
  }
}
