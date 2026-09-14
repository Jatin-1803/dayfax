import 'package:dailyfax/features/auth/domain/auth_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('AuthUser parses hasPassword', () {
    final user = AuthUser.fromJson({
      'id': 'u1',
      'phoneCountryCode': '+91',
      'phone': '9876543210',
      'fullName': 'Riya',
      'roles': ['CUSTOMER'],
      'hasPassword': true,
    });
    expect(user.hasPassword, isTrue);
    expect(user.fullName, 'Riya');
    expect(user.primaryAppRole, 'CUSTOMER');
  });

  test('AuthUser defaults hasPassword to false', () {
    final user = AuthUser.fromJson({
      'id': 'u2',
      'phone': '9876543210',
      'roles': ['CUSTOMER'],
    });
    expect(user.hasPassword, isFalse);
  });
}
