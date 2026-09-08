import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/network/api_client.dart';
import '../../../core/routing/auth_gate.dart';
import '../../../core/theme/app_theme.dart';
import '../data/auth_repository.dart';
import '../domain/auth_models.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    dio: ref.watch(dioProvider),
    tokenStorage: ref.watch(tokenStorageProvider),
  );
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
      ref.invalidate(sessionBootstrapProvider);
      ref.read(isAuthenticatedProvider.notifier).state = true;
      state = AuthAuthenticated(session);
    } on AppFailure catch (failure) {
      state = AuthError(failure.message);
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
    return true;
  } on AppFailure {
    await repo.logout();
    return false;
  }
});
