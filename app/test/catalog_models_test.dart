import 'package:dailyfax/features/catalog/domain/catalog_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('CatalogProduct parses list payload', () {
    final product = CatalogProduct.fromJson({
      'id': 'p1',
      'name': 'Fresh Milk',
      'slug': 'fresh-milk',
      'description': 'Farm-fresh milk',
      'brand': 'Dailyfax Dairy',
      'imageUrl': 'https://example.com/milk.jpg',
      'category': {'id': 'c1', 'name': 'Grocery'},
      'store': {'id': 's1', 'name': 'Dailyfax Mart'},
      'defaultVariant': {
        'id': 'v1',
        'unitLabel': '500 ml',
        'pricePaise': 3000,
        'mrpPaise': 3500,
        'discountPercent': 14,
        'quantityAvailable': 100,
        'inStock': true,
      },
    });

    expect(product.name, 'Fresh Milk');
    expect(product.pricePaise, 3000);
    expect(product.inStock, isTrue);
    expect(product.storeName, 'Dailyfax Mart');
  });

  test('ProductPage parses pagination meta', () {
    final page = ProductPage.fromJson({
      'items': [],
      'pagination': {
        'page': 1,
        'limit': 20,
        'total': 0,
        'totalPages': 1,
        'hasNextPage': false,
        'hasPreviousPage': false,
      },
    });

    expect(page.items, isEmpty);
    expect(page.pagination.hasNextPage, isFalse);
  });

  test('CatalogProductDetail picks default variant', () {
    final detail = CatalogProductDetail.fromJson({
      'id': 'p1',
      'name': 'Fresh Milk',
      'slug': 'fresh-milk',
      'category': {'id': 'c1', 'name': 'Grocery'},
      'storeId': 's1',
      'variants': [
        {
          'id': 'v2',
          'sku': 'MILK-1L',
          'unitLabel': '1 litre',
          'pricePaise': 5800,
          'mrpPaise': 6500,
          'discountPercent': 10,
          'isDefault': false,
          'quantityAvailable': 40,
          'inStock': true,
        },
        {
          'id': 'v1',
          'sku': 'MILK-500ML',
          'unitLabel': '500 ml',
          'pricePaise': 3000,
          'mrpPaise': 3500,
          'discountPercent': 14,
          'isDefault': true,
          'quantityAvailable': 100,
          'inStock': true,
        },
      ],
    });

    expect(detail.defaultVariant?.id, 'v1');
    expect(detail.variants.length, 2);
  });
}
