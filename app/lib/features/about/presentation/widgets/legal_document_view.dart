import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/i18n/app_locale.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/about_config.dart';
import '../../data/about_external.dart';
import '../../data/legal_content.dart';
import '../../data/legal_models.dart';

class LegalDocumentView extends ConsumerWidget {
  const LegalDocumentView({
    super.key,
    required this.document,
    this.showOpenWebsite = true,
  });

  final LegalDocument document;
  final bool showOpenWebsite;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeControllerProvider).value ?? AppLocale.en;
    final theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
      children: [
        Text(
          document.title.resolve(locale),
          style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: CustomerSpacing.sm),
        Text(
          ref.t('about.doc_meta', {
            'version': document.version,
            'effective': document.effectiveDate,
            'updated': document.lastUpdated,
          }),
          style: theme.textTheme.bodySmall?.copyWith(
            color: CustomerColors.onSurfaceVariant,
          ),
        ),
        if (showOpenWebsite && document.externalUrl != null) ...[
          const SizedBox(height: CustomerSpacing.md),
          OutlinedButton.icon(
            onPressed: () => openExternalUri(Uri.parse(document.externalUrl!)),
            icon: const Icon(Icons.open_in_new, size: 18),
            label: Text(ref.t('about.open_on_website')),
          ),
        ],
        const SizedBox(height: CustomerSpacing.lg),
        for (final section in document.sections) ...[
          Text(
            section.title.resolve(locale),
            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: CustomerSpacing.sm),
          for (final p in section.paragraphs) ...[
            Text(
              p.resolve(locale),
              style: theme.textTheme.bodyMedium?.copyWith(
                color: CustomerColors.onSurface,
                height: 1.45,
              ),
            ),
            const SizedBox(height: CustomerSpacing.sm),
          ],
          if (section.bullets.isNotEmpty) ...[
            ...section.bullets.map(
              (b) => Padding(
                padding: const EdgeInsets.only(bottom: CustomerSpacing.sm),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '•  ',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: CustomerColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        b.resolve(locale),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          height: 1.45,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: CustomerSpacing.md),
        ],
        Text(
          AboutConfig.copyrightLine(),
          style: theme.textTheme.bodySmall?.copyWith(
            color: CustomerColors.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: CustomerSpacing.xl),
      ],
    );
  }
}

/// Resolves a document id path segment.
LegalDocumentId? parseLegalDocumentId(String raw) {
  return switch (raw) {
    'terms' => LegalDocumentId.terms,
    'privacy' => LegalDocumentId.privacy,
    'refund' => LegalDocumentId.refund,
    'community' => LegalDocumentId.community,
    'safety' => LegalDocumentId.safety,
    'disclaimer' => LegalDocumentId.disclaimer,
    _ => null,
  };
}

String legalDocumentPath(LegalDocumentId id) {
  return switch (id) {
    LegalDocumentId.terms => 'terms',
    LegalDocumentId.privacy => 'privacy',
    LegalDocumentId.refund => 'refund',
    LegalDocumentId.community => 'community',
    LegalDocumentId.safety => 'safety',
    LegalDocumentId.disclaimer => 'disclaimer',
  };
}

LegalDocument legalDocumentFor(LegalDocumentId id) => LegalCatalog.document(id);
