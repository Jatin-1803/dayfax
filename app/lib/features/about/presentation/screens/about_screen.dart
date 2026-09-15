import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/i18n/app_locale.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/dayfax_logo.dart';
import '../../data/about_config.dart';
import '../../data/legal_content.dart';
import '../widgets/about_nav_tile.dart';
import '../widgets/legal_document_view.dart';

class AboutScreen extends ConsumerWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeControllerProvider).value ?? AppLocale.en;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('about.title'))),
      body: ListView(
        padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
        children: [
          Semantics(
            header: true,
            child: Material(
              color: CustomerColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(CustomerRadius.md),
              child: Ink(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(CustomerRadius.md),
                  border: Border.all(
                    color: CustomerColors.outlineVariant.withValues(alpha: 0.3),
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(CustomerSpacing.lg),
                  child: Column(
                    children: [
                      DayfaxLogo(
                        height: 48,
                        semanticLabel: AboutConfig.appName,
                      ),
                      const SizedBox(height: CustomerSpacing.md),
                      Text(
                        AboutConfig.appName,
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: CustomerSpacing.xs),
                      Text(
                        ref.t('about.version_build', {
                          'version': AboutConfig.appVersion,
                          'build': AboutConfig.buildNumber,
                        }),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: CustomerColors.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: CustomerSpacing.sm),
                      Text(
                        locale == AppLocale.hi
                            ? AboutConfig.appTaglineHi
                            : AboutConfig.appTaglineEn,
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: CustomerColors.onSurfaceVariant,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: CustomerSpacing.sm),
                      Text(
                        ref.t('about.developed_by', {
                          'name': AboutConfig.developerName,
                        }),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: CustomerColors.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: CustomerSpacing.xs),
                      Text(
                        AboutConfig.copyrightLine(),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: CustomerColors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: CustomerSpacing.lg),
          Text(ref.t('about.section_info'), style: theme.textTheme.titleMedium),
          const SizedBox(height: CustomerSpacing.sm),
          AboutNavTile(
            icon: Icons.info_outline,
            title: ref.t('about.about_app'),
            subtitle: ref.t('about.about_app_subtitle'),
            onTap: () => context.push('/about/app'),
          ),
          AboutNavTile(
            icon: Icons.mail_outline,
            title: ref.t('about.contact'),
            subtitle: ref.t('about.contact_subtitle'),
            onTap: () => context.push('/about/contact'),
          ),
          AboutNavTile(
            icon: Icons.balance_outlined,
            title: ref.t('about.licenses'),
            subtitle: ref.t('about.licenses_subtitle'),
            onTap: () => context.push('/about/licenses'),
          ),
          const SizedBox(height: CustomerSpacing.lg),
          Text(ref.t('about.section_legal'), style: theme.textTheme.titleMedium),
          const SizedBox(height: CustomerSpacing.sm),
          for (final item in LegalCatalog.menuDocuments())
            AboutNavTile(
              icon: aboutIcon(item.icon),
              title: item.title.resolve(locale),
              subtitle: item.shortDescription.resolve(locale),
              onTap: () => context.push('/about/${legalDocumentPath(item.id)}'),
            ),
          const SizedBox(height: CustomerSpacing.xl),
        ],
      ),
    );
  }
}
