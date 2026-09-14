import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import '../network/api_client.dart';
import 'app_block.dart';
import 'client_headers.dart';

class AppAnnouncement {
  const AppAnnouncement({
    required this.id,
    required this.title,
    required this.message,
    required this.dismissible,
    this.severity = 'INFO',
  });

  final String id;
  final String title;
  final String message;
  final bool dismissible;
  final String severity;
}

class BootstrapState {
  const BootstrapState({
    this.block,
    this.optionalUpdate,
    this.announcements = const [],
    this.config = const {},
  });

  final AppBlock? block;
  final AppBlock? optionalUpdate;
  final List<AppAnnouncement> announcements;
  final Map<String, String> config;

  /// Customer OTP login path; defaults on when bootstrap omits the flag.
  bool get loginOtpEnabled => config['login_otp'] != 'false';
}

/// Resolved after bootstrap; defaults OTP on only while config is still unknown.
final loginOtpEnabledProvider = Provider<bool>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  return bootstrap.maybeWhen(
    data: (state) => state.loginOtpEnabled,
    orElse: () => true,
  );
});

final clientHeadersProvider = Provider<ClientHeaders>((ref) => ClientHeaders());

final dismissedAnnouncementsProvider = StateProvider<Set<String>>((ref) => {});

final shownOptionalUpdateProvider = StateProvider<bool>((ref) => false);

final appBootstrapProvider = FutureProvider<BootstrapState>((ref) async {
  final dio = ref.watch(dioProvider);
  final headers = await ref.read(clientHeadersProvider).build();
  try {
    final response = await dio.get<Map<String, dynamic>>(
      '/app/bootstrap',
      options: Options(headers: headers),
    );
    final data = response.data?['data'];
    if (data is! Map) return const BootstrapState();
    final map = Map<String, dynamic>.from(data);
    AppBlock? block;
    if (map['maintenance'] is Map && map['maintenance']['enabled'] == true) {
      final maintenance = Map<String, dynamic>.from(map['maintenance'] as Map);
      block = AppBlock(
        reason: AppBlockReason.maintenance,
        title: maintenance['title'] as String?,
        message: maintenance['message'] as String?,
        expectedEndAt: maintenance['expectedEndAt']?.toString(),
      );
    } else if (map['updateRequired'] == true) {
      block = AppBlock(
        reason: AppBlockReason.forceUpdate,
        title: map['title'] as String?,
        message: map['message'] as String?,
        storeUrl: map['storeUrl'] as String?,
      );
    }
    AppBlock? optional;
    if (block == null && map['updateAvailable'] == true) {
      optional = AppBlock(
        reason: AppBlockReason.forceUpdate,
        title: map['title'] as String?,
        message: map['message'] as String?,
        storeUrl: map['storeUrl'] as String?,
      );
    }
    final announcements = <AppAnnouncement>[];
    final raw = map['announcements'];
    if (raw is List) {
      for (final item in raw) {
        if (item is Map) {
          announcements.add(
            AppAnnouncement(
              id: '${item['id']}',
              title: '${item['title'] ?? ''}',
              message: '${item['message'] ?? ''}',
              dismissible: item['dismissible'] != false,
              severity: '${item['severity'] ?? 'INFO'}',
            ),
          );
        }
      }
    }
    if (block != null) {
      ref.read(appBlockProvider.notifier).state = block;
    }
    final config = <String, String>{};
    final rawConfig = map['config'];
    if (rawConfig is Map) {
      for (final entry in rawConfig.entries) {
        config['${entry.key}'] = '${entry.value}';
      }
    }
    return BootstrapState(
      block: block,
      optionalUpdate: optional,
      announcements: announcements,
      config: config,
    );
  } catch (_) {
    return const BootstrapState();
  }
});

