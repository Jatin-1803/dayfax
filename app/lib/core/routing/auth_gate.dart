import 'package:flutter_riverpod/legacy.dart';

/// Explicit session flag used by routing.
final isAuthenticatedProvider = StateProvider<bool?>((ref) => null);

/// Customer must set a password before entering the app (first OTP login).
final pendingPasswordSetupProvider = StateProvider<bool>((ref) => false);
