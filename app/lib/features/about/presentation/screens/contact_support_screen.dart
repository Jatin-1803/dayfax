import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../data/about_config.dart';
import '../../data/about_external.dart';

class ContactSupportScreen extends ConsumerWidget {
  const ContactSupportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('about.contact'))),
      body: ListView(
        padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
        children: [
          Text(
            ref.t('about.contact_intro'),
            style: theme.textTheme.bodyMedium?.copyWith(
              color: CustomerColors.onSurfaceVariant,
              height: 1.45,
            ),
          ),
          const SizedBox(height: CustomerSpacing.lg),
          _Card(
            children: [
              _Row(label: ref.t('about.label_developer'), value: AboutConfig.developerName),
              if (AboutConfig.legalEntityName.trim().isNotEmpty)
                _Row(
                  label: ref.t('about.label_legal_entity'),
                  value: AboutConfig.legalEntityName,
                ),
              _Row(label: ref.t('about.label_support_email'), value: AboutConfig.supportEmail),
              _Row(label: ref.t('about.label_website'), value: AboutConfig.websiteUrl),
              if (AboutConfig.supportPhone.trim().isNotEmpty)
                _Row(label: ref.t('about.label_phone'), value: AboutConfig.supportPhone),
              if (AboutConfig.businessAddress.trim().isNotEmpty)
                _Row(label: ref.t('about.label_address'), value: AboutConfig.businessAddress),
            ],
          ),
          const SizedBox(height: CustomerSpacing.lg),
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
          if (AboutConfig.supportPhone.trim().isNotEmpty) ...[
            const SizedBox(height: CustomerSpacing.sm),
            AppButton(
              label: ref.t('about.call_support'),
              variant: AppButtonVariant.outline,
              icon: Icons.phone_outlined,
              onPressed: () => openExternalUri(
                Uri(scheme: 'tel', path: AboutConfig.supportPhone),
              ),
            ),
          ],
          const SizedBox(height: CustomerSpacing.lg),
          Text(
            ref.t('about.order_support_hint'),
            style: theme.textTheme.bodySmall?.copyWith(
              color: CustomerColors.onSurfaceVariant,
              height: 1.4,
            ),
          ),
          const SizedBox(height: CustomerSpacing.xl),
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Material(
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
          padding: const EdgeInsets.all(CustomerSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: children,
          ),
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: CustomerSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: CustomerColors.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}
