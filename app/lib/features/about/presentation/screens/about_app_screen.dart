import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/i18n/app_locale.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/dayfax_logo.dart';
import '../../data/about_app_copy.dart';
import '../../data/about_config.dart';
import '../../data/about_external.dart';

class AboutAppScreen extends ConsumerWidget {
  const AboutAppScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeControllerProvider).value ?? AppLocale.en;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('about.about_app'))),
      body: ListView(
        padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
        children: [
          Center(
            child: DayfaxLogo(height: 56, semanticLabel: AboutConfig.appName),
          ),
          const SizedBox(height: CustomerSpacing.lg),
          _SectionTitle(ref.t('about.app_overview')),
          Text(
            AboutAppCopy.overview.resolve(locale),
            style: theme.textTheme.bodyMedium?.copyWith(height: 1.45),
          ),
          const SizedBox(height: CustomerSpacing.md),
          _SectionTitle(ref.t('about.key_features')),
          for (final f in AboutAppCopy.features)
            _Bullet(f.resolve(locale)),
          const SizedBox(height: CustomerSpacing.md),
          _SectionTitle(ref.t('about.intended_for')),
          Text(
            AboutAppCopy.intendedFor.resolve(locale),
            style: theme.textTheme.bodyMedium?.copyWith(height: 1.45),
          ),
          const SizedBox(height: CustomerSpacing.lg),
          _SectionTitle(ref.t('about.developer_info')),
          _InfoRow(ref.t('about.label_developer'), AboutConfig.developerName),
          if (AboutConfig.legalEntityName.trim().isNotEmpty)
            _InfoRow(ref.t('about.label_legal_entity'), AboutConfig.legalEntityName),
          _InfoRow(ref.t('about.label_website'), AboutConfig.websiteUrl),
          _InfoRow(ref.t('about.label_support_email'), AboutConfig.supportEmail),
          if (AboutConfig.businessAddress.trim().isNotEmpty)
            _InfoRow(ref.t('about.label_address'), AboutConfig.businessAddress),
          const SizedBox(height: CustomerSpacing.md),
          AppButton(
            label: ref.t('about.email_support'),
            icon: Icons.mail_outline,
            onPressed: () => openExternalUri(AboutConfig.mailtoSupport()),
          ),
          const SizedBox(height: CustomerSpacing.sm),
          AppButton(
            label: ref.t('about.visit_website'),
            variant: AppButtonVariant.outline,
            icon: Icons.language,
            onPressed: () => openExternalUri(AboutConfig.websiteUri),
          ),
          const SizedBox(height: CustomerSpacing.lg),
          _SectionTitle(ref.t('about.version_info')),
          _InfoRow(ref.t('about.label_version'), AboutConfig.appVersion),
          _InfoRow(ref.t('about.label_build'), AboutConfig.buildNumber),
          _InfoRow(ref.t('about.label_last_updated'), AboutConfig.legalLastUpdated),
          const SizedBox(height: CustomerSpacing.lg),
          _SectionTitle(ref.t('about.copyright')),
          Text(
            AboutConfig.copyrightLine(),
            style: theme.textTheme.bodyMedium?.copyWith(
              color: CustomerColors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: CustomerSpacing.lg),
          TextButton(
            onPressed: () => context.push('/about/contact'),
            child: Text(ref.t('about.contact')),
          ),
          const SizedBox(height: CustomerSpacing.xl),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: CustomerSpacing.sm),
      child: Text(
        text,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: CustomerSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: CustomerColors.onSurfaceVariant,
                  ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: CustomerSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '•  ',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: CustomerColors.primary,
                  fontWeight: FontWeight.w700,
                ),
          ),
          Expanded(child: Text(text, style: Theme.of(context).textTheme.bodyMedium)),
        ],
      ),
    );
  }
}
