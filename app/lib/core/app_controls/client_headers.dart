import 'dart:io';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Keep in sync with `pubspec.yaml` `version` (`1.0.2+3`).
const appVersionName = '1.0.2';
const appBuildNumber = '3';

class ClientHeaders {
  ClientHeaders({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const _deviceKey = 'dailyfax_device_id';
  final FlutterSecureStorage _storage;
  Map<String, String>? _cached;

  Future<Map<String, String>> build() async {
    if (_cached != null) return _cached!;
    final deviceId = await _deviceId();
    _cached = {
      'X-Device-Id': deviceId,
      'X-App-Platform': Platform.isIOS ? 'ios' : 'android',
      'X-App-Version': appVersionName,
      'X-App-Build': appBuildNumber,
      'X-Os-Version': Platform.operatingSystemVersion,
    };
    return _cached!;
  }

  Future<String> _deviceId() async {
    final existing = await _storage.read(key: _deviceKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final created = '${DateTime.now().microsecondsSinceEpoch}-${Random.secure().nextInt(1 << 32)}';
    await _storage.write(key: _deviceKey, value: created);
    return created;
  }
}
