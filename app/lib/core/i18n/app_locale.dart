enum AppLocale {
  en('en'),
  hi('hi');

  const AppLocale(this.code);
  final String code;

  static const supported = AppLocale.values;

  static AppLocale fromCode(String? code) {
    if (code == 'hi') return AppLocale.hi;
    return AppLocale.en;
  }

  String get displayName => switch (this) {
        AppLocale.en => 'English',
        AppLocale.hi => 'हिन्दी',
      };
}
