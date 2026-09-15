import '../../../core/i18n/app_locale.dart';

/// Localized string for About / legal body copy (not UI chrome i18n keys).
class L10nText {
  const L10nText({required this.en, required this.hi});

  final String en;
  final String hi;

  String resolve(AppLocale locale) => locale == AppLocale.hi ? hi : en;
}

class LegalSection {
  const LegalSection({
    required this.title,
    this.paragraphs = const [],
    this.bullets = const [],
  });

  final L10nText title;
  final List<L10nText> paragraphs;
  final List<L10nText> bullets;
}

enum LegalDocumentId {
  terms,
  privacy,
  refund,
  community,
  safety,
  disclaimer,
}

class LegalDocumentMeta {
  const LegalDocumentMeta({
    required this.id,
    required this.title,
    required this.shortDescription,
    required this.icon,
    this.externalUrl,
  });

  final LegalDocumentId id;
  final L10nText title;
  final L10nText shortDescription;
  final IconDataRef icon;
  final String? externalUrl;
}

/// Avoid importing Flutter in pure data if possible — use int codePoint / name.
/// Screens map [IconDataRef] to Material icons.
enum IconDataRef {
  description,
  privacyTip,
  currencyExchange,
  groups,
  healthAndSafety,
  gavel,
  info,
  mail,
  balance,
  apps,
}

class LegalDocument {
  const LegalDocument({
    required this.id,
    required this.title,
    required this.version,
    required this.effectiveDate,
    required this.lastUpdated,
    required this.sections,
    this.externalUrl,
  });

  final LegalDocumentId id;
  final L10nText title;
  final String version;
  final String effectiveDate;
  final String lastUpdated;
  final List<LegalSection> sections;
  final String? externalUrl;
}
