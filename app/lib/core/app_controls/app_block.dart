import 'package:flutter_riverpod/legacy.dart';

enum AppBlockReason {
  forceUpdate,
  maintenance,
  sessionExpired,
  accountSuspended,
  accountBanned,
  accountLocked,
  accountInactive,
  serviceUnavailable,
}

class AppBlock {
  const AppBlock({
    required this.reason,
    this.title,
    this.message,
    this.storeUrl,
    this.expectedEndAt,
  });

  final AppBlockReason reason;
  final String? title;
  final String? message;
  final String? storeUrl;
  final String? expectedEndAt;
}

final appBlockProvider = StateProvider<AppBlock?>((ref) => null);

AppBlock? blockFromErrorCode(String? code, String? message) {
  switch (code) {
    case 'UNSUPPORTED_APP_VERSION':
      return AppBlock(reason: AppBlockReason.forceUpdate, message: message);
    case 'MAINTENANCE':
      return AppBlock(reason: AppBlockReason.maintenance, message: message);
    case 'SESSION_REVOKED':
    case 'SESSION_IDLE':
    case 'SESSION_EXPIRED':
      return AppBlock(reason: AppBlockReason.sessionExpired, message: message);
    case 'ACCOUNT_SUSPENDED':
      return AppBlock(reason: AppBlockReason.accountSuspended, message: message);
    case 'ACCOUNT_BANNED':
      return AppBlock(reason: AppBlockReason.accountBanned, message: message);
    case 'ACCOUNT_LOCKED':
      return AppBlock(reason: AppBlockReason.accountLocked, message: message);
    case 'ACCOUNT_INACTIVE':
      return AppBlock(reason: AppBlockReason.accountInactive, message: message);
    default:
      return null;
  }
}

String? readErrorCode(Object? data) {
  if (data is Map) {
    final error = data['error'];
    if (error is Map && error['code'] is String) return error['code'] as String;
  }
  return null;
}
