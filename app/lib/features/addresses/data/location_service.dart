import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';

import '../../../core/errors/app_failure.dart';

class ResolvedLocation {
  const ResolvedLocation({
    required this.latitude,
    required this.longitude,
    this.line1 = '',
    this.line2 = '',
    this.city = '',
    this.state = '',
    this.pincode = '',
  });

  final double latitude;
  final double longitude;
  final String line1;
  final String line2;
  final String city;
  final String state;
  final String pincode;
}

class LocationService {
  Future<void> ensureReady() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      await Geolocator.openLocationSettings();
      throw const ValidationFailure(
        'Location is turned off. Enable GPS and try again.',
      );
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      throw const ValidationFailure(
        'Location permission is required to use your current location.',
      );
    }
    if (permission == LocationPermission.deniedForever) {
      await Geolocator.openAppSettings();
      throw const ValidationFailure(
        'Location permission is permanently denied. Enable it in app settings.',
      );
    }
  }

  Future<ResolvedLocation> resolveCurrentLocation({
    bool requestPermission = true,
  }) async {
    if (requestPermission) {
      await ensureReady();
    }

    final position = await _readPosition();
    if (kDebugMode) {
      debugPrint(
        'LocationService: got ${position.latitude}, ${position.longitude}',
      );
    }

    final place = await _reverseGeocode(position.latitude, position.longitude);
    // Retry once — geocoding can flake on cold start.
    final resolved = place ??
        await _reverseGeocode(position.latitude, position.longitude);

    var line1 = resolved?.line1 ?? '';
    final line2 = resolved?.line2 ?? '';
    var city = resolved?.city ?? '';
    final state = resolved?.state ?? '';
    final pincode = resolved?.pincode ?? '';

    if (city.isEmpty) {
      city = 'Nearby';
    }
    // Never store raw coordinates as the address line shown in the UI.
    if (line1.isEmpty) {
      line1 = city;
    }

    return ResolvedLocation(
      latitude: position.latitude,
      longitude: position.longitude,
      line1: line1,
      line2: line2,
      city: city,
      state: state,
      pincode: RegExp(r'^\d{6}$').hasMatch(pincode) ? pincode : '',
    );
  }

  Future<Position> _readPosition() async {
    // 1) Instant path — cached fix beats hanging on a cold GPS lock.
    final lastKnown = await Geolocator.getLastKnownPosition();
    if (lastKnown != null) {
      final age = DateTime.now().toUtc().difference(lastKnown.timestamp.toUtc());
      if (age <= const Duration(minutes: 30)) {
        if (kDebugMode) {
          debugPrint('LocationService: using fresh-enough lastKnown (${age.inSeconds}s old)');
        }
        return lastKnown;
      }
    }

    // 2) One active request at a time. Plugin timeLimit calls cancelGetCurrentPosition
    //    (plain Dart .timeout does NOT cancel native fused-location).
    //    medium = PRIORITY_BALANCED (network/wifi). Never use lowest=PASSIVE.
    final fresh = await _tryCurrentPosition(
      accuracy: LocationAccuracy.medium,
      timeLimit: const Duration(seconds: 8),
    );
    if (fresh != null) return fresh;

    final low = await _tryCurrentPosition(
      accuracy: LocationAccuracy.low,
      timeLimit: const Duration(seconds: 6),
    );
    if (low != null) return low;

    if (lastKnown != null) return lastKnown;

    throw const ValidationFailure(
      'Could not get GPS fix. Try outdoors, or add address manually.',
    );
  }

  Future<Position?> _tryCurrentPosition({
    required LocationAccuracy accuracy,
    required Duration timeLimit,
  }) async {
    try {
      if (kDebugMode) {
        debugPrint('LocationService: getCurrentPosition accuracy=$accuracy');
      }
      return await Geolocator.getCurrentPosition(
        locationSettings: _settings(accuracy: accuracy, timeLimit: timeLimit),
      );
    } on TimeoutException catch (error) {
      if (kDebugMode) {
        debugPrint('LocationService: timeout $accuracy — $error');
      }
      return null;
    } catch (error) {
      if (kDebugMode) {
        debugPrint('LocationService: error $accuracy — $error');
      }
      return null;
    }
  }

  LocationSettings _settings({
    required LocationAccuracy accuracy,
    required Duration timeLimit,
  }) {
    if (!kIsWeb && Platform.isAndroid) {
      return AndroidSettings(
        accuracy: accuracy,
        timeLimit: timeLimit,
        // Fused provider is fine on Pixel; interval helps first callback arrive.
        intervalDuration: const Duration(seconds: 1),
      );
    }
    if (!kIsWeb && Platform.isIOS) {
      return AppleSettings(
        accuracy: accuracy,
        timeLimit: timeLimit,
      );
    }
    return LocationSettings(
      accuracy: accuracy,
      timeLimit: timeLimit,
    );
  }

  Future<({String line1, String line2, String city, String state, String pincode})?>
      _reverseGeocode(double latitude, double longitude) async {
    try {
      final places = await Geocoding()
          .placemarkFromCoordinates(latitude, longitude)
          .timeout(const Duration(seconds: 4));
      if (places.isEmpty) return null;

      final place = places.first;
      final streetParts = <String>[
        if (place.name != null &&
            place.name!.trim().isNotEmpty &&
            place.name != place.locality)
          place.name!.trim(),
        if (place.street != null && place.street!.trim().isNotEmpty)
          place.street!.trim(),
      ];
      return (
        line1: streetParts.toSet().join(', '),
        line2: [
          if (place.subLocality != null && place.subLocality!.trim().isNotEmpty)
            place.subLocality!.trim(),
        ].join(', '),
        city: (place.locality ?? place.subAdministrativeArea ?? '').trim(),
        state: (place.administrativeArea ?? '').trim(),
        pincode: (place.postalCode ?? '').trim(),
      );
    } catch (error) {
      if (kDebugMode) {
        debugPrint('LocationService: reverse geocode skipped — $error');
      }
      return null;
    }
  }
}

final locationServiceProvider = Provider<LocationService>((ref) {
  return LocationService();
});
