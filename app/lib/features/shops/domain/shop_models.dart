import 'package:equatable/equatable.dart';

class ShopSummary extends Equatable {
  const ShopSummary({
    required this.id,
    required this.name,
    required this.slug,
    required this.storeType,
    required this.isPopular,
    this.imageUrl,
    this.description,
    this.phoneCountryCode,
    this.phone,
    this.addressSummary,
    this.city,
    this.latitude,
    this.longitude,
  });

  final String id;
  final String name;
  final String slug;
  final String storeType;
  final bool isPopular;
  final String? imageUrl;
  final String? description;
  final String? phoneCountryCode;
  final String? phone;
  final String? addressSummary;
  final String? city;
  final double? latitude;
  final double? longitude;

  String? get displayPhone {
    if (phone == null || phone!.isEmpty) return null;
    final code = (phoneCountryCode ?? '+91').startsWith('+')
        ? (phoneCountryCode ?? '+91')
        : '+${phoneCountryCode ?? '91'}';
    return '$code $phone';
  }

  factory ShopSummary.fromJson(Map<String, dynamic> json) {
    return ShopSummary(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      storeType: json['storeType'] as String? ?? 'FOOD',
      isPopular: json['isPopular'] as bool? ?? false,
      imageUrl: json['imageUrl'] as String?,
      description: json['description'] as String?,
      phoneCountryCode: json['phoneCountryCode'] as String?,
      phone: json['phone'] as String?,
      addressSummary: json['addressSummary'] as String?,
      city: json['city'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
    );
  }

  @override
  List<Object?> get props => [id, slug, name];
}
