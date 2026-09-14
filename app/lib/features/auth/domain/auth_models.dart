import 'package:equatable/equatable.dart';

class AuthUser extends Equatable {
  const AuthUser({
    required this.id,
    required this.roles,
    this.phoneCountryCode,
    this.phone,
    this.fullName,
    this.email,
    this.avatarUrl,
    this.hasPassword = false,
  });

  final String id;
  final String? phoneCountryCode;
  final String? phone;
  final List<String> roles;
  final String? fullName;
  final String? email;
  final String? avatarUrl;
  final bool hasPassword;

  bool get hasPhone {
    final digits = phone?.replaceAll(RegExp(r'\D'), '') ?? '';
    return digits.length >= 10;
  }

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
      phoneCountryCode: json['phoneCountryCode'] as String?,
      phone: json['phone'] as String?,
      fullName: json['fullName'] as String?,
      email: json['email'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      hasPassword: json['hasPassword'] == true,
      roles: (json['roles'] as List<dynamic>? ?? const [])
          .map((e) => e.toString())
          .toList(),
    );
  }

  AuthUser copyWith({
    String? fullName,
    String? phone,
    String? phoneCountryCode,
    bool? hasPassword,
  }) {
    return AuthUser(
      id: id,
      phoneCountryCode: phoneCountryCode ?? this.phoneCountryCode,
      phone: phone ?? this.phone,
      roles: roles,
      fullName: fullName ?? this.fullName,
      email: email,
      avatarUrl: avatarUrl,
      hasPassword: hasPassword ?? this.hasPassword,
    );
  }

  @override
  List<Object?> get props => [id, phone, roles, fullName, email, hasPassword];
}

class AuthSession extends Equatable {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
    this.isNewUser = false,
  });

  final String accessToken;
  final String refreshToken;
  final AuthUser user;
  final bool isNewUser;

  @override
  List<Object?> get props => [accessToken, refreshToken, user, isNewUser];
}
