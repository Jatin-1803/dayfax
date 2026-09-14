import 'package:equatable/equatable.dart';

class SupportMessage extends Equatable {
  const SupportMessage({
    required this.id,
    required this.sender,
    required this.body,
    required this.at,
  });

  final String id;
  final String sender;
  final String body;
  final DateTime at;

  bool get isAgent => sender == 'AGENT';

  factory SupportMessage.fromJson(Map<String, dynamic> json) {
    return SupportMessage(
      id: json['id'] as String? ?? '',
      sender: json['sender'] as String? ?? 'AGENT',
      body: json['body'] as String? ?? '',
      at: DateTime.tryParse(json['at'] as String? ?? '') ?? DateTime.now(),
    );
  }

  @override
  List<Object?> get props => [id, sender, body];
}

class SupportOrderItem extends Equatable {
  const SupportOrderItem({
    required this.id,
    required this.productName,
    required this.quantity,
    this.variantLabel,
    this.isLocalShop = false,
  });

  final String id;
  final String productName;
  final String? variantLabel;
  final int quantity;
  final bool isLocalShop;

  factory SupportOrderItem.fromJson(Map<String, dynamic> json) {
    return SupportOrderItem(
      id: json['id'] as String? ?? '',
      productName: json['productName'] as String? ?? '',
      variantLabel: json['variantLabel'] as String?,
      quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      isLocalShop: json['isLocalShop'] as bool? ?? false,
    );
  }

  @override
  List<Object?> get props => [id, quantity];
}

class SupportThread extends Equatable {
  const SupportThread({
    required this.agentName,
    required this.messages,
    this.orderNumber = '',
    this.storeName = '',
    this.placedAt,
    this.returnStatus,
    this.showItemPicker = false,
    this.canReportDamage = false,
    this.orderItems = const [],
  });

  final String agentName;
  final List<SupportMessage> messages;
  final String orderNumber;
  final String storeName;
  final DateTime? placedAt;
  final String? returnStatus;
  final bool showItemPicker;
  final bool canReportDamage;
  final List<SupportOrderItem> orderItems;

  bool get showDamageForm => showItemPicker || canReportDamage;

  bool get hasOpenReturn =>
      returnStatus != null && returnStatus!.isNotEmpty && returnStatus != 'REJECTED';

  factory SupportThread.fromJson(Map<String, dynamic> json) {
    final conversation = json['conversation'] as Map<String, dynamic>? ?? const {};
    final order = json['order'] as Map<String, dynamic>? ?? const {};
    final returnRequest = json['returnRequest'] as Map<String, dynamic>?;
    final messagesJson = json['messages'] as List<dynamic>? ?? const [];
    final itemsJson = json['orderItems'] as List<dynamic>? ?? const [];
    final picker = json['showItemPicker'] as bool? ?? json['canReportDamage'] as bool? ?? false;
    final placedRaw = order['placedAt'] as String?;
    return SupportThread(
      agentName: conversation['agentName'] as String? ?? 'Ananya',
      orderNumber: order['orderNumber'] as String? ?? '',
      storeName: order['storeName'] as String? ?? '',
      placedAt: placedRaw == null || placedRaw.isEmpty ? null : DateTime.tryParse(placedRaw),
      returnStatus: returnRequest?['status'] as String?,
      messages: messagesJson.whereType<Map<String, dynamic>>().map(SupportMessage.fromJson).toList(),
      showItemPicker: picker,
      canReportDamage: picker,
      orderItems: itemsJson.whereType<Map<String, dynamic>>().map(SupportOrderItem.fromJson).toList(),
    );
  }

  @override
  List<Object?> get props => [
        agentName,
        orderNumber,
        storeName,
        returnStatus,
        messages.length,
        showItemPicker,
        if (messages.isNotEmpty) messages.last.id,
      ];
}
