import 'package:dailyfax/features/addresses/domain/address_models.dart';
import 'package:dailyfax/features/cart/domain/cart_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('UserAddress summary and draft round-trip fields', () {
    final address = UserAddress.fromJson({
      'id': 'a1',
      'label': 'Home',
      'fullName': 'Rahul Sharma',
      'line1': '12 Market Road',
      'line2': null,
      'city': 'Launch Town',
      'pincode': '226001',
      'isDefault': true,
    });
    expect(address.summaryLine, contains('12 Market Road'));
    expect(address.fullName, 'Rahul Sharma');
    expect(AddressDraft.fromAddress(address).city, 'Launch Town');
    expect(AddressDraft.fromAddress(address).toJson()['fullName'], 'Rahul Sharma');
  });

  test('Cart parses items and totals', () {
    final cart = Cart.fromJson({
      'id': 'c1',
      'storeId': 's1',
      'serviceAreaId': 'sa1',
      'itemCount': 2,
      'subtotalPaise': 6000,
      'currency': 'INR',
      'items': [
        {
          'id': 'i1',
          'variantId': 'v1',
          'quantity': 2,
          'unitPricePaise': 3000,
          'lineTotalPaise': 6000,
          'unitLabel': '500 ml',
          'mrpPaise': 3500,
          'currentPricePaise': 3000,
          'priceChanged': false,
          'quantityAvailable': 100,
          'inStock': true,
          'exceedsStock': false,
          'product': {
            'id': 'p1',
            'name': 'Fresh Milk',
            'slug': 'fresh-milk',
            'imageUrl': null,
          },
        },
      ],
    });

    expect(cart.itemCount, 2);
    expect(cart.items.first.product.name, 'Fresh Milk');
    expect(cart.subtotalPaise, 6000);
  });
}
