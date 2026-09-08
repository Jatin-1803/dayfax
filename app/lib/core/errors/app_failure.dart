sealed class AppFailure implements Exception {
  const AppFailure(this.message);

  final String message;
}

class NetworkFailure extends AppFailure {
  const NetworkFailure([super.message = 'error.network']);
}

class TimeoutFailure extends AppFailure {
  const TimeoutFailure([super.message = 'error.timeout']);
}

class UnauthorizedFailure extends AppFailure {
  const UnauthorizedFailure([super.message = 'error.sign_in']);
}

class ValidationFailure extends AppFailure {
  const ValidationFailure([super.message = 'error.check_input']);
}

class NotFoundFailure extends AppFailure {
  const NotFoundFailure([super.message = 'error.not_found_long']);
}

class ConflictFailure extends AppFailure {
  const ConflictFailure([super.message = 'error.conflict']);
}

class ServerFailure extends AppFailure {
  const ServerFailure([super.message = 'error.generic']);
}

class UnknownFailure extends AppFailure {
  const UnknownFailure([super.message = 'error.generic']);
}
