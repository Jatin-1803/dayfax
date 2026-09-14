import 'package:equatable/equatable.dart';

class CartProduct extends Equatable {
  const CartProduct({
    required this.id,
    required this.name,
    required this.slug,
    this.imageUrl,
  });

  final String id;
  final String name;
  final String slug;
  final String? imageUrl;

  factory CartProduct.fromJson(Map<String, dynamic> json) {
    return CartProduct(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      imageUrl: json['imageUrl'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, slug];
}

class CartItem extends Equatable {
  const CartItem({
    required this.id,
    required this.variantId,
    required this.quantity,
    required this.unitPricePaise,
    required this.lineTotalPaise,
    required this.product,
    required this.unitLabel,
    this.storeId,
    this.isLocalShop = false,
    this.requiresOnlinePayment = false,
    required this.mrpPaise,
    required this.currentPricePaise,
    required this.priceChanged,
    required this.quantityAvailable,
    required this.inStock,
    required this.exceedsStock,
  });

  final String id;
  final String variantId;
  final int quantity;
  final int unitPricePaise;
  final int lineTotalPaise;
  final CartProduct product;
  final String? storeId;
  final String unitLabel;
  final bool isLocalShop;
  final bool requiresOnlinePayment;
  final int mrpPaise;
  final int currentPricePaise;
  final bool priceChanged;
  final int quantityAvailable;
  final bool inStock;
  final bool exceedsStock;

  factory CartItem.fromJson(Map<String, dynamic> json) {
    return CartItem(
      id: json['id'] as String,
      variantId: json['variantId'] as String,
      quantity: (json['quantity'] as num).toInt(),
      unitPricePaise: (json['unitPricePaise'] as num).toInt(),
      lineTotalPaise: (json['lineTotalPaise'] as num).toInt(),
      product: CartProduct.fromJson(json['product'] as Map<String, dynamic>),
      storeId: json['storeId'] as String?,
      unitLabel: json['unitLabel'] as String? ?? '',
      isLocalShop: json['isLocalShop'] as bool? ?? false,
      requiresOnlinePayment: json['requiresOnlinePayment'] as bool? ?? false,
      mrpPaise: (json['mrpPaise'] as num?)?.toInt() ?? 0,
      currentPricePaise: (json['currentPricePaise'] as num?)?.toInt() ?? 0,
      priceChanged: json['priceChanged'] as bool? ?? false,
      quantityAvailable: (json['quantityAvailable'] as num?)?.toInt() ?? 0,
      inStock: json['inStock'] as bool? ?? false,
      exceedsStock: json['exceedsStock'] as bool? ?? false,
    );
  }

  CartItem copyWith({int? quantity, int? lineTotalPaise}) {
    return CartItem(
      id: id,
      variantId: variantId,
      quantity: quantity ?? this.quantity,
      unitPricePaise: unitPricePaise,
      lineTotalPaise: lineTotalPaise ?? this.lineTotalPaise,
      product: product,
      storeId: storeId,
      unitLabel: unitLabel,
      isLocalShop: isLocalShop,
      requiresOnlinePayment: requiresOnlinePayment,
      mrpPaise: mrpPaise,
      currentPricePaise: currentPricePaise,
      priceChanged: priceChanged,
      quantityAvailable: quantityAvailable,
      inStock: inStock,
      exceedsStock: exceedsStock,
    );
  }

  @override
  List<Object?> get props => [id, quantity, unitPricePaise];
}

class Cart extends Equatable {
  const Cart({
    required this.items,
    required this.itemCount,
    required this.subtotalPaise,
    this.id,
    this.storeId,
    this.serviceAreaId,
    this.isLocalShop = false,
    this.codAllowed = true,
    this.localShopSubtotalPaise = 0,
    this.regularSubtotalPaise = 0,
    this.currency = 'INR',
  });

  final String? id;
  final String? storeId;
  final String? serviceAreaId;
  final bool isLocalShop;
  final bool codAllowed;
  final int localShopSubtotalPaise;
  final int regularSubtotalPaise;
  final List<CartItem> items;
  final int itemCount;
  final int subtotalPaise;
  final String currency;

  bool get isEmpty => items.isEmpty;

  bool get hasMixedGroups =>
      items.any((item) => item.isLocalShop) && items.any((item) => !item.isLocalShop);

  bool get isLocalOnly => items.isNotEmpty && items.every((item) => item.isLocalShop);

  bool get hasOnlineRequiredItems => items.any((item) => item.requiresOnlinePayment);

  bool get requiresOnlineOnly =>
      items.isNotEmpty && items.every((item) => item.requiresOnlinePayment);

  /// COD can be selected unless every item requires online payment.
  bool get canSelectCod => !requiresOnlineOnly;

  factory Cart.empty() => const Cart(items: [], itemCount: 0, subtotalPaise: 0);

  factory Cart.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['items'] as List<dynamic>? ?? const [];
    final items = itemsJson.whereType<Map<String, dynamic>>().map(CartItem.fromJson).toList();
    final parsedCodAllowed = json['codAllowed'] as bool?;
    return Cart(
      id: json['id'] as String?,
      storeId: json['storeId'] as String?,
      serviceAreaId: json['serviceAreaId'] as String?,
      isLocalShop: json['isLocalShop'] as bool? ?? false,
      codAllowed: parsedCodAllowed ??
          (items.isEmpty || items.any((item) => !item.requiresOnlinePayment)),
      localShopSubtotalPaise: (json['localShopSubtotalPaise'] as num?)?.toInt() ?? 0,
      regularSubtotalPaise: (json['regularSubtotalPaise'] as num?)?.toInt() ?? 0,
      items: items,
      itemCount: (json['itemCount'] as num?)?.toInt() ?? 0,
      subtotalPaise: (json['subtotalPaise'] as num?)?.toInt() ?? 0,
      currency: json['currency'] as String? ?? 'INR',
    );
  }

  @override
  List<Object?> get props => [id, itemCount, subtotalPaise, items, isLocalShop, codAllowed];
}
