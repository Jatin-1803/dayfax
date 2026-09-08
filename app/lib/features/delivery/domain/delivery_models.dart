import 'package:equatable/equatable.dart';

enum DeliveryJobsTab {
  available('available'),
  active('active'),
  completed('completed');

  const DeliveryJobsTab(this.apiValue);

  final String apiValue;

  static DeliveryJobsTab fromQuery(String? value) {
    return DeliveryJobsTab.values.firstWhere(
      (tab) => tab.apiValue == value,
      orElse: () => DeliveryJobsTab.available,
    );
  }

  String get title => switch (this) {
        DeliveryJobsTab.available => 'Pending',
        DeliveryJobsTab.active => 'My orders',
        DeliveryJobsTab.completed => 'Done',
      };
}

/// MySQL DECIMAL / drivers sometimes serialize coords as strings.
double? _coordFromJson(Object? value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value.trim());
  return null;
}

class DeliveryStats extends Equatable {
  const DeliveryStats({
    required this.available,
    required this.active,
    required this.completedToday,
  });

  final int available;
  final int active;
  final int completedToday;

  factory DeliveryStats.fromJson(Map<String, dynamic> json) {
    return DeliveryStats(
      available: (json['available'] as num?)?.toInt() ?? 0,
      active: (json['active'] as num?)?.toInt() ?? 0,
      completedToday: (json['completedToday'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [available, active, completedToday];
}

class DeliveryStore extends Equatable {
  const DeliveryStore({
    required this.id,
    required this.name,
    this.phoneCountryCode,
    this.phone,
    this.addressLine1,
    this.addressLine2,
    this.landmark,
    this.city,
    this.pincode,
    this.latitude,
    this.longitude,
  });

  final String id;
  final String name;
  final String? phoneCountryCode;
  final String? phone;
  final String? addressLine1;
  final String? addressLine2;
  final String? landmark;
  final String? city;
  final String? pincode;
  final double? latitude;
  final double? longitude;

  String get addressSummary {
    final parts = <String>[
      if (addressLine1 != null && addressLine1!.isNotEmpty) addressLine1!,
      if (addressLine2 != null && addressLine2!.isNotEmpty) addressLine2!,
      if (landmark != null && landmark!.isNotEmpty) landmark!,
      if (city != null && city!.isNotEmpty) city!,
      if (pincode != null && pincode!.isNotEmpty) pincode!,
    ];
    return parts.join(', ');
  }

  String? get displayPhone {
    if (phone == null || phone!.isEmpty) return null;
    final code = (phoneCountryCode ?? '+91').startsWith('+')
        ? (phoneCountryCode ?? '+91')
        : '+${phoneCountryCode ?? '91'}';
    return '$code $phone';
  }

  bool get canOpenMap =>
      (latitude != null && longitude != null) || addressSummary.trim().isNotEmpty;

  bool get canCall => phone != null && phone!.trim().isNotEmpty;

  factory DeliveryStore.fromJson(Map<String, dynamic> json) {
    return DeliveryStore(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      phoneCountryCode: json['phoneCountryCode'] as String?,
      phone: json['phone'] as String?,
      addressLine1: json['addressLine1'] as String?,
      addressLine2: json['addressLine2'] as String?,
      landmark: json['landmark'] as String?,
      city: json['city'] as String?,
      pincode: json['pincode'] as String?,
      latitude: _coordFromJson(json['latitude']),
      longitude: _coordFromJson(json['longitude']),
    );
  }

  @override
  List<Object?> get props => [id, name, phone];
}

class DeliveryJobAddress extends Equatable {
  const DeliveryJobAddress({
    required this.id,
    required this.label,
    required this.line1,
    this.fullName,
    required this.city,
    this.line2,
    this.landmark,
    this.state,
    this.pincode,
    this.latitude,
    this.longitude,
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

  String get summary {
    final parts = <String>[
      line1,
      if (line2 != null && line2!.isNotEmpty) line2!,
      if (landmark != null && landmark!.isNotEmpty) landmark!,
      city,
      if (state != null && state!.isNotEmpty) state!,
      if (pincode != null && pincode!.isNotEmpty) pincode!,
    ];
    return parts.join(', ');
  }

  String? get coordinatesLabel {
    if (latitude == null || longitude == null) return null;
    return '${latitude!.toStringAsFixed(5)}, ${longitude!.toStringAsFixed(5)}';
  }

  factory DeliveryJobAddress.fromJson(Map<String, dynamic> json) {
    return DeliveryJobAddress(
      id: json['id'] as String,
      label: json['label'] as String? ?? 'Address',
      fullName: json['fullName'] as String?,
      line1: json['line1'] as String? ?? '',
      line2: json['line2'] as String?,
      landmark: json['landmark'] as String?,
      city: json['city'] as String? ?? '',
      state: json['state'] as String?,
      pincode: json['pincode'] as String?,
      latitude: _coordFromJson(json['latitude']),
      longitude: _coordFromJson(json['longitude']),
    );
  }

  @override
  List<Object?> get props => [id, line1, city];
}

class DeliveryCustomerContact extends Equatable {
  const DeliveryCustomerContact({
    required this.phoneCountryCode,
    required this.phone,
  });

  final String phoneCountryCode;
  final String phone;

  String get displayPhone {
    final code = phoneCountryCode.startsWith('+')
        ? phoneCountryCode
        : '+$phoneCountryCode';
    return '$code $phone';
  }

  factory DeliveryCustomerContact.fromJson(Map<String, dynamic> json) {
    return DeliveryCustomerContact(
      phoneCountryCode: json['phoneCountryCode'] as String? ?? '91',
      phone: json['phone'] as String,
    );
  }

  @override
  List<Object?> get props => [phone];
}

class DeliveryAssignment extends Equatable {
  const DeliveryAssignment({
    required this.id,
    required this.status,
    required this.assignedAt,
    this.acceptedAt,
    this.completedAt,
  });

  final String id;
  final String status;
  final DateTime assignedAt;
  final DateTime? acceptedAt;
  final DateTime? completedAt;

  bool get isAssigned => status == 'ASSIGNED';
  bool get isAccepted => status == 'ACCEPTED';
  bool get isInProgress => status == 'IN_PROGRESS';
  bool get isCompleted => status == 'COMPLETED';
  bool get isRejected => status == 'REJECTED';

  factory DeliveryAssignment.fromJson(Map<String, dynamic> json) {
    return DeliveryAssignment(
      id: json['id'] as String,
      status: json['status'] as String,
      assignedAt: DateTime.parse(json['assignedAt'] as String),
      acceptedAt: json['acceptedAt'] == null
          ? null
          : DateTime.parse(json['acceptedAt'] as String),
      completedAt: json['completedAt'] == null
          ? null
          : DateTime.parse(json['completedAt'] as String),
    );
  }

  @override
  List<Object?> get props => [id, status];
}

class DeliveryJobItem extends Equatable {
  const DeliveryJobItem({
    required this.id,
    required this.productName,
    required this.variantLabel,
    required this.unitPricePaise,
    required this.quantity,
    required this.lineTotalPaise,
    this.imageUrl,
  });

  final String id;
  final String productName;
  final String variantLabel;
  final int unitPricePaise;
  final int quantity;
  final int lineTotalPaise;
  final String? imageUrl;

  factory DeliveryJobItem.fromJson(Map<String, dynamic> json) {
    return DeliveryJobItem(
      id: json['id'] as String,
      productName: json['productName'] as String,
      variantLabel: json['variantLabel'] as String? ?? '',
      unitPricePaise: (json['unitPricePaise'] as num).toInt(),
      quantity: (json['quantity'] as num).toInt(),
      lineTotalPaise: (json['lineTotalPaise'] as num).toInt(),
      imageUrl: json['imageUrl'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, quantity];
}

class DeliveryJobPayment extends Equatable {
  const DeliveryJobPayment({
    required this.method,
    required this.status,
    required this.amountPaise,
    required this.collectAmountPaise,
  });

  final String method;
  final String status;
  final int amountPaise;
  final int collectAmountPaise;

  bool get isCod => method == 'COD';
  bool get isCaptured => status == 'CAPTURED';

  factory DeliveryJobPayment.fromJson(Map<String, dynamic> json) {
    return DeliveryJobPayment(
      method: json['method'] as String? ?? 'COD',
      status: json['status'] as String? ?? 'PENDING',
      amountPaise: (json['amountPaise'] as num?)?.toInt() ?? 0,
      collectAmountPaise: (json['collectAmountPaise'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [method, status, amountPaise, collectAmountPaise];
}

class PaymentQrSession extends Equatable {
  const PaymentQrSession({
    required this.status,
    required this.amountPaise,
    this.qrId,
    this.imageUrl,
    this.attemptId,
  });

  final String status;
  final int amountPaise;
  final String? qrId;
  final String? imageUrl;
  final String? attemptId;

  factory PaymentQrSession.fromJson(Map<String, dynamic> json) {
    return PaymentQrSession(
      status: json['status'] as String? ?? 'PENDING',
      amountPaise: (json['amountPaise'] as num?)?.toInt() ?? 0,
      qrId: json['qrId'] as String?,
      imageUrl: json['imageUrl'] as String?,
      attemptId: json['attemptId'] as String?,
    );
  }

  @override
  List<Object?> get props => [status, amountPaise, qrId, imageUrl];
}

class PaymentCheckResult extends Equatable {
  const PaymentCheckResult({
    required this.status,
    required this.amountPaise,
  });

  final String status;
  final int amountPaise;

  factory PaymentCheckResult.fromJson(Map<String, dynamic> json) {
    return PaymentCheckResult(
      status: json['status'] as String? ?? 'PENDING',
      amountPaise: (json['amountPaise'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [status, amountPaise];
}

class DeliveryJob extends Equatable {
  const DeliveryJob({
    required this.orderId,
    required this.orderNumber,
    required this.orderStatus,
    required this.grandTotalPaise,
    required this.currency,
    required this.placedAt,
    required this.store,
    required this.address,
    this.notes,
    this.customer,
    this.assignment,
    this.payment,
    this.otpAllowed = false,
    this.items = const [],
  });

  final String orderId;
  final String orderNumber;
  final String orderStatus;
  final int grandTotalPaise;
  final String currency;
  final String? notes;
  final DateTime placedAt;
  final DeliveryStore store;
  final DeliveryJobAddress address;
  final DeliveryCustomerContact? customer;
  final DeliveryAssignment? assignment;
  final DeliveryJobPayment? payment;
  final bool otpAllowed;
  final List<DeliveryJobItem> items;

  bool get canClaim => assignment == null;
  bool get canAccept => assignment?.isAssigned ?? false;
  bool get canStartDelivery =>
      assignment != null && (assignment!.isAccepted || assignment!.isAssigned);
  bool get canComplete =>
      assignment != null && assignment!.isInProgress && otpAllowed;
  bool get canReject =>
      assignment != null && (assignment!.isAssigned || assignment!.isAccepted);
  bool get needsCodCollection =>
      payment?.isCod == true && payment?.isCaptured != true;
  bool get isPaidOnline =>
      payment != null && !payment!.isCod && payment!.isCaptured;

  bool get canOpenMap =>
      (address.latitude != null && address.longitude != null) ||
      address.summary.trim().isNotEmpty;

  String get detailRouteId => assignment?.id ?? orderId;

  factory DeliveryJob.fromJson(Map<String, dynamic> json) {
    final customerJson = json['customer'] as Map<String, dynamic>?;
    final assignmentJson = json['assignment'] as Map<String, dynamic>?;
    final itemsJson = json['items'] as List<dynamic>?;
    final paymentJson = json['payment'] as Map<String, dynamic>?;
    return DeliveryJob(
      orderId: json['orderId'] as String,
      orderNumber: json['orderNumber'] as String,
      orderStatus: json['orderStatus'] as String,
      grandTotalPaise: (json['grandTotalPaise'] as num).toInt(),
      currency: json['currency'] as String? ?? 'INR',
      notes: json['notes'] as String?,
      placedAt: DateTime.parse(json['placedAt'] as String),
      store: DeliveryStore.fromJson(json['store'] as Map<String, dynamic>? ?? const {}),
      address: DeliveryJobAddress.fromJson(
        json['address'] as Map<String, dynamic>? ?? const {},
      ),
      customer: customerJson == null ? null : DeliveryCustomerContact.fromJson(customerJson),
      assignment:
          assignmentJson == null ? null : DeliveryAssignment.fromJson(assignmentJson),
      payment: paymentJson == null ? null : DeliveryJobPayment.fromJson(paymentJson),
      otpAllowed: json['otpAllowed'] as bool? ?? false,
      items: itemsJson == null
          ? const []
          : itemsJson.whereType<Map<String, dynamic>>().map(DeliveryJobItem.fromJson).toList(),
    );
  }

  @override
  List<Object?> get props =>
      [orderId, orderNumber, assignment?.id, assignment?.status, payment?.status, otpAllowed];
}

class DeliveryJobsPage extends Equatable {
  const DeliveryJobsPage({
    required this.tab,
    required this.items,
    required this.hasNextPage,
    required this.page,
  });

  final DeliveryJobsTab tab;
  final List<DeliveryJob> items;
  final bool hasNextPage;
  final int page;

  factory DeliveryJobsPage.fromJson(Map<String, dynamic> json) {
    final pagination = json['pagination'] as Map<String, dynamic>? ?? const {};
    final itemsJson = json['items'] as List<dynamic>? ?? const [];
    return DeliveryJobsPage(
      tab: DeliveryJobsTab.fromQuery(json['tab'] as String?),
      items: itemsJson.whereType<Map<String, dynamic>>().map(DeliveryJob.fromJson).toList(),
      hasNextPage: pagination['hasNextPage'] as bool? ?? false,
      page: (pagination['page'] as num?)?.toInt() ?? 1,
    );
  }

  @override
  List<Object?> get props => [tab, items, hasNextPage, page];
}
