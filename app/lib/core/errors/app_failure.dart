sealed class AppFailure implements Exception {
  const AppFailure(this.message);

  final String message;
}

class NetworkFailure extends AppFailure {
  const NetworkFailure([super.message = 'Please check your internet connection.']);
}

class TimeoutFailure extends AppFailure {
  const TimeoutFailure([super.message = 'Request timed out. Please try again.']);
}

class UnauthorizedFailure extends AppFailure {
  const UnauthorizedFailure([super.message = 'Please sign in again.']);
}

class ValidationFailure extends AppFailure {
  const ValidationFailure([super.message = 'Please check your input.']);
}

class NotFoundFailure extends AppFailure {
  const NotFoundFailure([super.message = 'We could not find what you were looking for.']);
}

class ServerFailure extends AppFailure {
  const ServerFailure([super.message = 'Something went wrong. Please try again.']);
}

class UnknownFailure extends AppFailure {
  const UnknownFailure([super.message = 'Something went wrong. Please try again.']);
}
