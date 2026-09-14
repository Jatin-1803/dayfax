import 'package:equatable/equatable.dart';

import '../../catalog/domain/catalog_models.dart';

class HomeCollection extends Equatable {
  const HomeCollection({
    required this.id,
    required this.headline,
    required this.products,
  });

  final String id;
  final String headline;
  final List<CatalogProduct> products;

  factory HomeCollection.fromJson(Map<String, dynamic> json) {
    final productsJson = json['products'];
    final products = productsJson is List
        ? productsJson
            .whereType<Map<String, dynamic>>()
            .map(CatalogProduct.fromJson)
            .toList()
        : const <CatalogProduct>[];
    return HomeCollection(
      id: json['id'] as String,
      headline: json['headline'] as String? ?? '',
      products: products,
    );
  }

  @override
  List<Object?> get props => [id, headline, products];
}
