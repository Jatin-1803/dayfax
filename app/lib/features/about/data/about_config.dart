import '../../../core/app_controls/client_headers.dart';

/// Central app / company / legal configuration for the About section.
///
/// Replace placeholder fields with production legal-entity details when available.
/// Do not invent registered company names, phone numbers, or addresses here.
abstract final class AboutConfig {
  static const String appName = 'DayFax';
  static const String appTaglineEn =
      'Local quick-commerce for groceries, vegetables, food, and daily essentials.';
  static const String appTaglineHi =
      'किराना, सब्ज़ी, खाना और रोज़मर्रा की ज़रूरतों के लिए लोकल क्विक-कॉमर्स।';

  /// Brand / operator name shown to users.
  static const String developerName = 'DayFax';

  /// Registered business / legal entity name when available.
  /// Leave empty until the real entity name is confirmed — do not invent one.
  static const String legalEntityName = '';

  static const String supportEmail = 'support@dayfax.in';
  static const String websiteUrl = 'https://dayfax.in';
  static const String privacyPolicyUrl = 'https://dayfax.in/privacy';
  static const String termsUrl = 'https://dayfax.in/terms';
  static const String deleteAccountUrl = 'https://dayfax.in/delete-account';

  /// Optional support phone. Empty = hide Call Support.
  static const String supportPhone = '';

  /// Optional public business address when legally required.
  static const String businessAddress = '';

  static const String copyrightHolder = 'DayFax';

  /// Jurisdiction for governing-law clauses (aligned with published website Terms).
  static const String governingLawRegion = 'India';

  /// Minimum age stated in published Terms (dayfax.in/terms).
  static const int minimumAgeYears = 18;

  static const String legalDocumentsVersion = '1.0';
  static const String legalEffectiveDate = '6 September 2026';
  static const String legalLastUpdated = '6 September 2026';

  static String get appVersion => appVersionName;
  static String get buildNumber => appBuildNumber;

  static int get copyrightYear => DateTime.now().year;

  static String copyrightLine() =>
      '© $copyrightYear $copyrightHolder. All rights reserved.';

  static Uri get websiteUri => Uri.parse(websiteUrl);
  static Uri get privacyUri => Uri.parse(privacyPolicyUrl);
  static Uri get termsUri => Uri.parse(termsUrl);
  static Uri get deleteAccountUri => Uri.parse(deleteAccountUrl);

  static Uri mailtoSupport({String? subject, String? body}) {
    final params = <String, String>{};
    if (subject != null && subject.isNotEmpty) params['subject'] = subject;
    if (body != null && body.isNotEmpty) params['body'] = body;
    return Uri(
      scheme: 'mailto',
      path: supportEmail,
      queryParameters: params.isEmpty ? null : params,
    );
  }
}
