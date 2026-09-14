import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/network/api_client.dart';
import '../../../core/routing/auth_gate.dart';
import '../../../core/theme/app_theme.dart';
import '../data/auth_repository.dart';
import '../data/google_auth_service.dart';
import '../domain/auth_models.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    dio: ref.watch(dioProvider),
    tokenStorage: ref.watch(tokenStorageProvider),
  );
});

final googleAuthServiceProvider = Provider<GoogleAuthService>((ref) {
  return GoogleAuthService();
});

final currentUserProvider = FutureProvider<AuthUser>((ref) async {
  return ref.watch(authRepositoryProvider).fetchMe();
});

sealed class AuthUiState {
  const AuthUiState();
}

class AuthInitial extends AuthUiState {
  const AuthInitial();
}

class AuthLoading extends AuthUiState {
  const AuthLoading();
}

class AuthOtpSent extends AuthUiState {
  const AuthOtpSent({required this.phone, this.devOtp});

  final String phone;
  final String? devOtp;
}

class AuthAuthenticated extends AuthUiState {
  const AuthAuthenticated(this.session);

  final AuthSession session;
}

class AuthPasswordSetupRequired extends AuthUiState {
  const AuthPasswordSetupRequired(this.session);

  final AuthSession session;
}

class AuthError extends AuthUiState {
  const AuthError(this.message);

  final String message;
}

class AuthViewModel extends Notifier<AuthUiState> {
  @override
  AuthUiState build() => const AuthInitial();

  AuthRepository get _repo => ref.read(authRepositoryProvider);

  Future<void> requestOtp(String phone) async {
    final normalized = phone.replaceAll(RegExp(r'\D'), '');
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(normalized)) {
      state = const AuthError('auth.invalid_phone');
      return;
    }

    state = const AuthLoading();
    try {
      final data = await _repo.requestOtp(phone: normalized);
      state = AuthOtpSent(
        phone: normalized,
        devOtp: data['devOtp']?.toString(),
      );
    } on AppFailure catch (failure) {
      state = AuthError(failure.message);
    }
  }

  Future<void> verifyOtp({
    required String phone,
    required String otp,
    bool requireDeliveryPartner = false,
  }) async {
    if (!RegExp(r'^\d{4,6}$').hasMatch(otp)) {
      state = const AuthError('auth.enter_otp');
      return;
    }

    state = const AuthLoading();
    try {
      final session = await _repo.verifyOtp(phone: phone, otp: otp);
      await _completeLogin(session, requireDeliveryPartner: requireDeliveryPartner);
    } on AppFailure catch (failure) {
      state = AuthError(failure.message);
    }
  }

  Future<void> loginWithPassword({
    required String phone,
    required String password,
  }) async {
    final normalized = phone.replaceAll(RegExp(r'\D'), '');
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(normalized)) {
      state = const AuthError('auth.invalid_phone');
      return;
    }
    if (password.length < 8) {
      state = const AuthError('auth.password_too_short');
      return;
    }

    state = const AuthLoading();
    try {
      final session = await _repo.loginWithPassword(
        phone: normalized,
        password: password,
      );
      await _completeLogin(session);
    } on AppFailure catch (failure) {
      state = AuthError(failure.message);
    }
  }

  Future<bool> checkHasPassword(String phone) async {
    final normalized = phone.replaceAll(RegExp(r'\D'), '');
    return _repo.passwordStatus(phone: normalized);
  }

  Future<void> registerWithPassword({
    required String phone,
    required String password,
    required String confirmPassword,
  }) async {
    final normalized = phone.replaceAll(RegExp(r'\D'), '');
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(normalized)) {
      state = const AuthError('auth.invalid_phone');
      return;
    }
    if (password.length < 8) {
      state = const AuthError('auth.password_too_short');
      return;
    }
    if (password != confirmPassword) {
      state = const AuthError('auth.password_mismatch');
      return;
    }

    state = const AuthLoading();
    try {
      final session = await _repo.registerWithPassword(
        phone: normalized,
        password: password,
        confirmPassword: confirmPassword,
      );
      await _completeLogin(session);
    } on AppFailure catch (failure) {
      state = AuthError(failure.message);
    }
  }

  Future<void> loginWithGoogle() async {
    state = const AuthLoading();
    try {
      final idToken = await ref.read(googleAuthServiceProvider).signInForIdToken();
      if (idToken == null) {
        state = const AuthInitial();
        return;
      }
      final session = await _repo.loginWithGoogle(idToken: idToken);
      // Google accounts skip forced password setup.
      await _completeLogin(session, requirePasswordSetup: false);
    } on AppFailure catch (failure) {
      state = AuthError(failure.message);
    } catch (_) {
      state = const AuthError('auth.google_failed');
    }
  }

  Future<void> _completeLogin(
    AuthSession session, {
    bool requireDeliveryPartner = false,
    bool requirePasswordSetup = true,
  }) async {
    final primary = session.user.primaryAppRole;
    if (primary == null) {
      await _repo.logout();
      state = const AuthError('auth.no_access');
      return;
    }

    if (requireDeliveryPartner && primary != 'DELIVERY_PARTNER') {
      await _repo.logout();
      state = const AuthError('auth.no_access');
      return;
    }

    ref.read(appRoleProvider.notifier).state = primary == 'DELIVERY_PARTNER'
        ? AppRole.deliveryPartner
        : AppRole.customer;

    final needsPasswordSetup =
        requirePasswordSetup && primary == 'CUSTOMER' && session.isNewUser;
    ref.read(pendingPasswordSetupProvider.notifier).state = needsPasswordSetup;
    ref.invalidate(currentUserProvider);

    if (needsPasswordSetup) {
      ref.read(isAuthenticatedProvider.notifier).state = false;
      state = AuthPasswordSetupRequired(session);
      return;
    }

    ref.invalidate(sessionBootstrapProvider);
    ref.read(isAuthenticatedProvider.notifier).state = true;
    state = AuthAuthenticated(session);
  }

  Future<bool> setInitialPassword({
    required String password,
    required String confirmPassword,
  }) async {
    if (password.length < 8) {
      state = const AuthError('auth.password_too_short');
      return false;
    }
    if (password != confirmPassword) {
      state = const AuthError('auth.password_mismatch');
      return false;
    }

    state = const AuthLoading();
    try {
      await _repo.setPassword(password: password, confirmPassword: confirmPassword);
      ref.read(pendingPasswordSetupProvider.notifier).state = false;
      ref.invalidate(sessionBootstrapProvider);
      ref.invalidate(currentUserProvider);
      ref.read(isAuthenticatedProvider.notifier).state = true;
      state = const AuthInitial();
      return true;
    } on AppFailure catch (failure) {
      state = AuthError(failure.message);
      return false;
    }
  }

  void resetError() {
    if (state is AuthError) {
      state = const AuthInitial();
    }
  }

  void reset() {
    state = const AuthInitial();
  }
}

final authViewModelProvider =
    NotifierProvider<AuthViewModel, AuthUiState>(AuthViewModel.new);

final sessionBootstrapProvider = FutureProvider<bool>((ref) async {
  final repo = ref.watch(authRepositoryProvider);
  final hasSession = await repo.hasSession();
  if (!hasSession) {
    return false;
  }

  try {
    final user = await repo.fetchMe();
    final primary = user.primaryAppRole;
    if (primary == null) {
      await repo.logout();
      return false;
    }
    ref.read(appRoleProvider.notifier).state = primary == 'DELIVERY_PARTNER'
        ? AppRole.deliveryPartner
        : AppRole.customer;
    ref.read(pendingPasswordSetupProvider.notifier).state = false;
    return true;
  } on AppFailure {
    await repo.logout();
    return false;
  }
});
