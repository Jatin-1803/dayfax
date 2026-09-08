import 'dart:io';

import 'package:url_launcher/url_launcher.dart';

import '../../features/delivery/domain/delivery_models.dart';

/// Opens external maps / dialer for delivery-partner actions.
abstract final class PartnerNavigation {
  static Future<bool> openCustomerMap(DeliveryJobAddress address) async {
    return openMap(
      latitude: address.latitude,
      longitude: address.longitude,
      query: address.summary,
    );
  }

  static Future<bool> openShopMap(DeliveryStore store) async {
    return openMap(
      latitude: store.latitude,
      longitude: store.longitude,
      query: store.addressSummary.isNotEmpty ? store.addressSummary : store.name,
    );
  }

  static Future<bool> openMap({
    double? latitude,
    double? longitude,
    required String query,
  }) async {
    final encoded = Uri.encodeComponent(query);
    final candidates = <Uri>[];
    if (latitude != null && longitude != null) {
      if (Platform.isIOS) {
        candidates.add(Uri.parse('https://maps.apple.com/?daddr=$latitude,$longitude'));
      }
      candidates.add(
        Uri.parse(
          'https://www.google.com/maps/dir/?api=1&destination=$latitude,$longitude',
        ),
      );
      candidates.add(Uri.parse('geo:$latitude,$longitude?q=$latitude,$longitude'));
    } else if (query.trim().isNotEmpty) {
      if (Platform.isIOS) {
        candidates.add(Uri.parse('https://maps.apple.com/?q=$encoded'));
      }
      candidates.add(
        Uri.parse(
          'https://www.google.com/maps/search/?api=1&query=$encoded',
        ),
      );
      candidates.add(Uri.parse('geo:0,0?q=$encoded'));
    } else {
      return false;
    }

    for (final uri in candidates) {
      if (await canLaunchUrl(uri)) {
        final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
        if (launched) return true;
      }
    }
    return false;
  }

  static Future<bool> callCustomer(DeliveryCustomerContact customer) async {
    return callPhone(
      phoneCountryCode: customer.phoneCountryCode,
      phone: customer.phone,
    );
  }

  static Future<bool> callShop(DeliveryStore store) async {
    if (store.phone == null || store.phone!.isEmpty) return false;
    return callPhone(
      phoneCountryCode: store.phoneCountryCode ?? '+91',
      phone: store.phone!,
    );
  }

  static Future<bool> callPhone({
    required String phoneCountryCode,
    required String phone,
  }) async {
    final digits = '$phoneCountryCode$phone'.replaceAll(RegExp(r'[^\d+]'), '');
    final uri = Uri(scheme: 'tel', path: digits);
    if (!await canLaunchUrl(uri)) return false;
    return launchUrl(uri);
  }
}
