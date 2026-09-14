import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'core/app_controls/app_block.dart';
import 'core/app_controls/app_gate.dart';
import 'core/app_controls/gate_screen.dart';
import 'core/i18n/app_locale.dart';
import 'core/i18n/i18n_providers.dart';
import 'core/push/push_notifications.dart';
import 'core/routing/app_router.dart';
import 'core/theme/app_theme.dart';
import 'features/delivery/presentation/delivery_view_models.dart';
import 'features/delivery/presentation/widgets/partner_new_order_alert_host.dart';
import 'features/orders/presentation/orders_view_models.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (await ensureFirebaseApp()) {
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  }
  runApp(const ProviderScope(child: DayFaxApp()));
}

void _invalidateOrdersForRoute(WidgetRef ref, String route) {
  final orderMatch = RegExp(r'^/orders/([^/]+)').firstMatch(route);
  if (orderMatch != null) {
    final id = orderMatch.group(1);
    if (id != null && id.isNotEmpty) {
      ref.invalidate(orderDetailViewModelProvider(id));
      ref.invalidate(ordersListViewModelProvider);
    }
    return;
  }

  final partnerMatch = RegExp(r'^/partner/jobs(?:/([^/]+))?').firstMatch(route);
  if (partnerMatch == null) return;
  invalidateDeliveryData(ref);
  final jobId = partnerMatch.group(1);
  if (jobId != null && jobId.isNotEmpty) {
    ref.invalidate(deliveryJobDetailProvider(jobId));
  }
}

class DayFaxApp extends ConsumerWidget {
  const DayFaxApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    ref.watch(pushSessionBinderProvider);
    final role = ref.watch(appRoleProvider);
    final partnerAuthSurface = ref.watch(partnerAuthSurfaceProvider);
    final localeAsync = ref.watch(localeControllerProvider);
    final locale = localeAsync.value ?? AppLocale.en;
    // Ensure bundle is loaded for current locale.
    ref.watch(i18nBundleProvider);
    final block = ref.watch(appBlockProvider);

    return _PushRouteListener(
      onOpen: (route) {
        _invalidateOrdersForRoute(ref, route);
        router.go(route);
      },
      child: MaterialApp.router(
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
      builder: (context, child) {
        if (block != null) return AppBlockScreen(block: block);
        return PartnerNewOrderAlertHost(
          child: _AppControlsOverlay(child: child ?? const SizedBox.shrink()),
        );
      },
    ),
    );
  }
}

class _AppControlsOverlay extends ConsumerStatefulWidget {
  const _AppControlsOverlay({required this.child});

  final Widget child;

  @override
  ConsumerState<_AppControlsOverlay> createState() => _AppControlsOverlayState();
}

class _AppControlsOverlayState extends ConsumerState<_AppControlsOverlay> {
  @override
  Widget build(BuildContext context) {
    final bootstrap = ref.watch(appBootstrapProvider).value;
    final dismissed = ref.watch(dismissedAnnouncementsProvider);
    final announcement = bootstrap?.announcements
        .where((item) => !dismissed.contains(item.id))
        .cast<AppAnnouncement?>()
        .firstWhere((item) => item != null, orElse: () => null);

    final optional = bootstrap?.optionalUpdate;
    final shown = ref.watch(shownOptionalUpdateProvider);
    if (optional != null && !shown) {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        if (!mounted || ref.read(shownOptionalUpdateProvider)) return;
        ref.read(shownOptionalUpdateProvider.notifier).state = true;
        await Future<void>.delayed(const Duration(milliseconds: 900));
        if (!mounted || !context.mounted || ref.read(appBlockProvider) != null) return;
        await showDialog<void>(
          context: context,
          barrierDismissible: true,
          builder: (dialogContext) {
            return AlertDialog(
              title: Text(optional.title ?? ref.t('app_gate.update_title')),
              content: Text(optional.message ?? ref.t('app_gate.update_optional')),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: Text(ref.t('app_gate.later')),
                ),
                if (optional.storeUrl != null && optional.storeUrl!.isNotEmpty)
                  TextButton(
                    onPressed: () {
                      final uri = Uri.tryParse(optional.storeUrl!);
                      if (uri != null) {
                        launchUrl(uri, mode: LaunchMode.externalApplication);
                      }
                      Navigator.of(dialogContext).pop();
                    },
                    child: Text(ref.t('app_gate.update')),
                  ),
              ],
            );
          },
        );
      });
    }

    return Column(
      children: [
        if (announcement != null) AnnouncementBanner(item: announcement),
        Expanded(child: widget.child),
      ],
    );
  }
}

class _PushRouteListener extends StatefulWidget {
  const _PushRouteListener({required this.onOpen, required this.child});

  final void Function(String route) onOpen;
  final Widget child;

  @override
  State<_PushRouteListener> createState() => _PushRouteListenerState();
}

class _PushRouteListenerState extends State<_PushRouteListener> {
  @override
  void initState() {
    super.initState();
    pushOpenRoute.addListener(_open);
  }

  @override
  void dispose() {
    pushOpenRoute.removeListener(_open);
    super.dispose();
  }

  void _open() {
    final route = pushOpenRoute.value;
    if (route == null || route.isEmpty) return;
    pushOpenRoute.value = null;
    widget.onOpen(route);
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
