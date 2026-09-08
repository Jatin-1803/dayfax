import 'package:equatable/equatable.dart';

class UserAddress extends Equatable {
  const UserAddress({
    required this.id,
    required this.label,
    required this.line1,
    this.fullName,
    required this.city,
    required this.isDefault,
    this.line2,
    this.landmark,
    this.state,
    this.pincode,
    this.latitude,
    this.longitude,
    this.serviceAreaId,
    this.deliveryZoneId,
  });

  final String id;
  final String label;
  final String? fullName;
  final String line1;
  final String? line2;
  final String? landmark;
  final String city;
  final String? state;
  final String? pincode;
  final double? latitude;
  final double? longitude;
  final String? serviceAreaId;
  final String? deliveryZoneId;
  final bool isDefault;

  String get summaryLine {
    final parts = <String>[
      line1,
      if (line2 != null && line2!.isNotEmpty) line2!,
      city,
      if (pincode != null && pincode!.isNotEmpty) pincode!,
    ];
    return parts.join(', ');
  }

  String get shortDisplay {
    final summary = summaryLine.trim();
    if (summary.isNotEmpty) {
      if (summary.length <= 36) return summary;
      return '${summary.substring(0, 36)}…';
    }
    if (line1.trim().isNotEmpty) {
      final short = line1.trim();
      if (short.length <= 28) return short;
      return '${short.substring(0, 28)}…';
    }
    return city;
  }

  factory UserAddress.fromJson(Map<String, dynamic> json) {
    return UserAddress(
      id: json['id'] as String,
      label: json['label'] as String? ?? 'Home',
      fullName: json['fullName'] as String?,
      line1: json['line1'] as String,
      line2: json['line2'] as String?,
      landmark: json['landmark'] as String?,
      city: json['city'] as String,
      state: json['state'] as String?,
      pincode: json['pincode'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      serviceAreaId: json['serviceAreaId'] as String?,
      deliveryZoneId: json['deliveryZoneId'] as String?,
      isDefault: json['isDefault'] as bool? ?? false,
    );
  }

  @override
  List<Object?> get props => [id, label, line1, isDefault];
}

class AddressDraft {
  AddressDraft({
    this.id,
    this.label = 'Home',
    this.fullName = '',
    this.line1 = '',
    this.line2 = '',
    this.landmark = '',
    this.city = '',
    this.state = '',
    this.pincode = '',
    this.isDefault = false,
    this.latitude,
    this.longitude,
  });

  final String? id;
  String label;
  String fullName;
  String line1;
  String line2;
  String landmark;
  String city;
  String state;
  String pincode;
  bool isDefault;
  double? latitude;
  double? longitude;

  factory AddressDraft.fromAddress(UserAddress address) {
    return AddressDraft(
      id: address.id,
      label: address.label,
      fullName: address.fullName ?? '',
      line1: address.line1,
      line2: address.line2 ?? '',
      landmark: address.landmark ?? '',
      city: address.city,
      state: address.state ?? '',
      pincode: address.pincode ?? '',
      isDefault: address.isDefault,
      latitude: address.latitude,
      longitude: address.longitude,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'label': label.trim(),
      'fullName': fullName.trim(),
      'line1': line1.trim(),
      if (line2.trim().isNotEmpty) 'line2': line2.trim(),
      if (landmark.trim().isNotEmpty) 'landmark': landmark.trim(),
      'city': city.trim(),
      if (state.trim().isNotEmpty) 'state': state.trim(),
      if (pincode.trim().isNotEmpty) 'pincode': pincode.trim(),
      'isDefault': isDefault,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
    };
  }
}
