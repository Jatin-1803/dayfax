import 'dart:developer' as developer;

import 'package:google_sign_in/google_sign_in.dart';

import '../../../core/config/google_auth_config.dart';
import '../../../core/errors/app_failure.dart';

/// Obtains a Google ID token for backend verification (Android).
class GoogleAuthService {
  GoogleAuthService();

  var _initialized = false;

  Future<void> _ensureInitialized() async {
    if (_initialized) return;
    await GoogleSignIn.instance.initialize(
      serverClientId: kGoogleServerClientId,
    );
    _initialized = true;
  }

  /// Returns an ID token, or null if the user cancelled.
  Future<String?> signInForIdToken() async {
    await _ensureInitialized();
    try {
      final account = await GoogleSignIn.instance.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null || idToken.isEmpty) {
        throw const ValidationFailure('auth.google_token_missing');
      }
      return idToken;
    } on GoogleSignInException catch (error) {
      developer.log(
        'GoogleSignInException code=${error.code} description=${error.description}',
        name: 'GoogleAuthService',
        error: error,
      );
      if (error.code == GoogleSignInExceptionCode.canceled) {
        return null;
      }
      throw ValidationFailure(_mapGoogleError(error));
    }
  }

  Future<void> signOut() async {
    await _ensureInitialized();
    await GoogleSignIn.instance.signOut();
  }

  String _mapGoogleError(GoogleSignInException error) {
    return switch (error.code) {
      GoogleSignInExceptionCode.canceled => 'auth.google_cancelled',
      GoogleSignInExceptionCode.interrupted => 'auth.google_cancelled',
      GoogleSignInExceptionCode.uiUnavailable => 'auth.google_failed',
      GoogleSignInExceptionCode.providerConfigurationError =>
        'auth.google_not_configured',
      GoogleSignInExceptionCode.clientConfigurationError =>
        'auth.google_not_configured',
      GoogleSignInExceptionCode.userMismatch => 'auth.google_failed',
      GoogleSignInExceptionCode.unknownError => 'auth.google_failed',
    };
  }
}
