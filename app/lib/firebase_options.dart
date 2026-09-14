import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions? get currentPlatform {
    if (kIsWeb) return null;
    if (defaultTargetPlatform == TargetPlatform.android) return android;
    return null;
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAuOLXxyRzXAmVDfd_oH-wnr4rH5ocivPQ',
    appId: '1:483191032228:android:2edc7fe8694ed180785931',
    messagingSenderId: '483191032228',
    projectId: 'dayfax',
    storageBucket: 'dayfax.firebasestorage.app',
  );
}
