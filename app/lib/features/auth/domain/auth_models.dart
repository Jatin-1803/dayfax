import 'package:equatable/equatable.dart';

class AuthUser extends Equatable {
  const AuthUser({
    required this.id,
    required this.phoneCountryCode,
    required this.phone,
    required this.roles,
    this.fullName,
    this.email,
    this.avatarUrl,
  });

  final String id;
  final String phoneCountryCode;
  final String phone;
  final List<String> roles;
  final String? fullName;
  final String? email;
  final String? avatarUrl;

  bool get isCustomer => roles.contains('CUSTOMER');
  bool get isDeliveryPartner => roles.contains('DELIVERY_PARTNER');

  /// Prefer delivery partner when dual-role (ops accounts); otherwise customer.
  String? get primaryAppRole {
    if (isDeliveryPartner) return 'DELIVERY_PARTNER';
    if (isCustomer) return 'CUSTOMER';
    return null;
  }

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String,
      phoneCountryCode: json['phoneCountryCode'] as String? ?? '+91',
      phone: json['phone'] as String,
      fullName: json['fullName'] as String?,
      email: json['email'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      roles: (json['roles'] as List<dynamic>? ?? const [])
          .map((e) => e.toString())
          .toList(),
    );
  }

  @override
  List<Object?> get props => [id, phone, roles, fullName];
}

class AuthSession extends Equatable {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  final String accessToken;
  final String refreshToken;
  final AuthUser user;

  @override
  List<Object?> get props => [accessToken, refreshToken, user];
}
