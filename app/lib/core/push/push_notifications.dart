import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';

import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../firebase_options.dart';
import '../../features/delivery/domain/partner_new_order_alert.dart';
import '../i18n/app_locale.dart';
import '../i18n/i18n_providers.dart';
import '../network/api_client.dart';
import '../routing/auth_gate.dart';
import '../theme/app_theme.dart';

const _channelId = 'dayfax_orders';
const _channelName = 'DayFax';
const _newOrdersChannelId = 'dayfax_new_orders';
const _newOrdersChannelName = 'New Orders';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await _ensureFirebase();
}

final pushNotificationsProvider = Provider<PushNotifications>((ref) {
  final service = PushNotifications();
  ref.onDispose(service.dispose);
  return service;
});

final pushSessionBinderProvider = Provider<void>((ref) {
  final authenticated = ref.watch(isAuthenticatedProvider);
  final role = ref.watch(appRoleProvider);
  final locale = ref.watch(localeControllerProvider).value ?? AppLocale.en;
  final service = ref.watch(pushNotificationsProvider);
  final dio = ref.watch(dioProvider);

  if (authenticated != true) return;

  unawaited(
    service.sync(
      dio: dio,
      appRole: role == AppRole.deliveryPartner ? 'DELIVERY_PARTNER' : 'CUSTOMER',
      locale: locale.code,
    ),
  );
});

class PushNotifications {
  final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();
  StreamSubscription<String>? _tokenRefreshSub;
  StreamSubscription<RemoteMessage>? _foregroundSub;
  StreamSubscription<RemoteMessage>? _openedSub;
  String? _token;
  bool _localReady = false;
  bool _permissionDenied = false;

  bool get permissionDenied => _permissionDenied;

  Future<void> sync({
    required Dio dio,
    required String appRole,
    required String locale,
  }) async {
    if (!await _ensureFirebase()) return;

    try {
      await _ensureLocalNotifications();
      await _requestPermission();
    } catch (error) {
      if (kDebugMode) {
        debugPrint('push_permission_setup_failed $error');
      }
    }

    final messaging = FirebaseMessaging.instance;
    final token = await _loadToken(messaging);
    if (token != null) {
      await _register(dio, token: token, appRole: appRole, locale: locale);
    }

    await _tokenRefreshSub?.cancel();
    _tokenRefreshSub = messaging.onTokenRefresh.listen((next) {
      unawaited(_register(dio, token: next, appRole: appRole, locale: locale));
    });

    await _foregroundSub?.cancel();
    _foregroundSub = FirebaseMessaging.onMessage.listen(_handleForeground);

    await _openedSub?.cancel();
    _openedSub = FirebaseMessaging.onMessageOpenedApp.listen(_openFromMessage);

    final initial = await messaging.getInitialMessage();
    if (initial != null) {
      _openFromMessage(initial);
    }
  }

  Future<void> unregister(Dio dio) async {
    final token = _token;
    _token = null;
    await _tokenRefreshSub?.cancel();
    _tokenRefreshSub = null;
    if (token == null || token.isEmpty) return;
    try {
      await dio.delete<Map<String, dynamic>>(
        '/devices',
        data: {'token': token},
      );
    } catch (_) {
      // Logout should still complete if the device row cannot be removed.
    }
  }

  void dispose() {
    unawaited(_tokenRefreshSub?.cancel());
    unawaited(_foregroundSub?.cancel());
    unawaited(_openedSub?.cancel());
  }

  Future<void> _register(
    Dio dio, {
    required String token,
    required String appRole,
    required String locale,
  }) async {
    _token = token;
    final body = {
      'token': token,
      'platform': Platform.isIOS ? 'ios' : 'android',
      'locale': locale == 'hi' ? 'hi' : 'en',
      'appRole': appRole,
    };
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        await dio.post<Map<String, dynamic>>('/devices', data: body);
        return;
      } catch (error) {
        if (kDebugMode) {
          debugPrint('device_register_failed attempt=${attempt + 1} $error');
        }
        if (attempt == 2) return;
        await Future<void>.delayed(Duration(seconds: attempt + 1));
      }
    }
  }

  Future<String?> _loadToken(FirebaseMessaging messaging) async {
    for (var attempt = 0; attempt < 4; attempt++) {
      try {
        final token = await messaging.getToken();
        if (token != null && token.isNotEmpty) return token;
      } catch (error) {
        if (kDebugMode) {
          debugPrint('fcm_token_failed attempt=${attempt + 1} $error');
        }
      }
      await Future<void>.delayed(Duration(seconds: attempt + 1));
    }
    return null;
  }

  Future<void> _requestPermission() async {
    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    _permissionDenied =
        settings.authorizationStatus == AuthorizationStatus.denied ||
        settings.authorizationStatus == AuthorizationStatus.notDetermined;
    if (Platform.isAndroid) {
      await _local
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
    }
  }

  Future<void> _ensureLocalNotifications() async {
    if (_localReady) return;
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const ios = DarwinInitializationSettings();
    await _local.initialize(
      settings: const InitializationSettings(android: android, iOS: ios),
      onDidReceiveNotificationResponse: (response) {
        final route = response.payload;
        if (route != null && route.isNotEmpty) {
          pushOpenRoute.value = route;
        }
      },
    );
    final androidPlugin =
        _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(
      const AndroidNotificationChannel(
        _channelId,
        _channelName,
        importance: Importance.high,
        playSound: true,
        enableVibration: true,
      ),
    );
    await androidPlugin?.createNotificationChannel(
      const AndroidNotificationChannel(
        _newOrdersChannelId,
        _newOrdersChannelName,
        description: 'High-priority alerts when a new delivery order is available',
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
      ),
    );
    _localReady = true;
  }

  Future<void> _handleForeground(RemoteMessage message) async {
    final type = message.data['type']?.toString() ?? '';
    final audience = message.data['audience']?.toString() ?? '';

    if (audience == 'partner' && type == 'partner_order_taken') {
      final orderId = message.data['orderId']?.toString() ?? '';
      signalPartnerOrderTaken(orderId);
      return;
    }

    if (audience == 'partner' && type == 'partner_new_order') {
      final alert = PartnerNewOrderAlert.fromPushData(message.data);
      if (alert.orderId.isNotEmpty) {
        presentPartnerNewOrderAlert(alert);
        return;
      }
    }

    await _showForegroundTray(message);
  }

  Future<void> _showForegroundTray(RemoteMessage message) async {
    final notification = message.notification;
    final title = notification?.title;
    final body = notification?.body;
    if (title == null || title.isEmpty) return;
    await _ensureLocalNotifications();
    final isNewOrder = message.data['type']?.toString() == 'partner_new_order';
    final channelId = isNewOrder ? _newOrdersChannelId : _channelId;
    final channelName = isNewOrder ? _newOrdersChannelName : _channelName;
    await _local.show(
      id: message.hashCode & 0x7fffffff,
      title: title,
      body: body,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          channelName,
          channelDescription: isNewOrder
              ? 'High-priority alerts when a new delivery order is available'
              : null,
          importance: isNewOrder ? Importance.max : Importance.high,
          priority: isNewOrder ? Priority.max : Priority.high,
          playSound: true,
          enableVibration: true,
          category: isNewOrder ? AndroidNotificationCategory.alarm : null,
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentSound: true,
          presentBadge: true,
        ),
      ),
      payload: routeForMessage(message),
    );
  }

  void _openFromMessage(RemoteMessage message) {
    final type = message.data['type']?.toString() ?? '';
    if (type == 'partner_order_taken') {
      final orderId = message.data['orderId']?.toString() ?? '';
      signalPartnerOrderTaken(orderId);
      return;
    }
    final route = routeForMessage(message);
    if (route == null) return;
    pushOpenRoute.value = route;
  }
}

final pushOpenRoute = ValueNotifier<String?>(null);

String? routeForMessage(RemoteMessage message) {
  final type = message.data['type']?.toString() ?? '';
  final audience = message.data['audience']?.toString() ?? '';
  if (type == 'promo') {
    return audience == 'partner' ? '/partner/home' : '/home';
  }
  if (type == 'partner_order_taken') {
    return '/partner/jobs';
  }
  final orderId = message.data['orderId']?.toString() ?? '';
  if (orderId.isEmpty) return null;
  if (audience == 'partner') return '/partner/jobs/$orderId';
  return '/orders/$orderId';
}

Future<bool> ensureFirebaseApp() => _ensureFirebase();

Future<bool> _ensureFirebase() async {
  if (Firebase.apps.isNotEmpty) return true;
  final options = DefaultFirebaseOptions.currentPlatform;
  if (options == null) return false;
  try {
    await Firebase.initializeApp(options: options);
    return true;
  } catch (error) {
    if (kDebugMode) {
      debugPrint('firebase_init_failed $error');
    }
    return false;
  }
}
