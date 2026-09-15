import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/i18n/app_locale.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../data/about_config.dart';
import '../../data/about_external.dart';

/// Explains how to request account deletion (no automated in-app delete API yet).
class DeleteAccountScreen extends ConsumerWidget {
  const DeleteAccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('about.delete_account'))),
      body: ListView(
        padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
        children: [
          Text(
            ref.t('about.delete_account_intro'),
            style: theme.textTheme.bodyMedium?.copyWith(height: 1.45),
          ),
          const SizedBox(height: CustomerSpacing.md),
          Text(
            ref.t('about.delete_account_steps_title'),
            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: CustomerSpacing.sm),
          Text(
            ref.t('about.delete_account_steps', {
              'email': AboutConfig.supportEmail,
            }),
            style: theme.textTheme.bodyMedium?.copyWith(height: 1.45),
          ),
          const SizedBox(height: CustomerSpacing.md),
          Text(
            ref.t('about.delete_account_retention'),
            style: theme.textTheme.bodyMedium?.copyWith(
              color: CustomerColors.onSurfaceVariant,
              height: 1.45,
            ),
          ),
          const SizedBox(height: CustomerSpacing.lg),
          AppButton(
            label: ref.t('about.request_deletion_email'),
            icon: Icons.mail_outline,
            onPressed: () {
              final locale =
                  ref.read(localeControllerProvider).value ?? AppLocale.en;
              final subject = locale == AppLocale.hi
                  ? 'खाता हटाने का अनुरोध'
                  : 'Account deletion request';
              final body = locale == AppLocale.hi
                  ? 'कृपया मेरा DayFax खाता हटा दें।\n\nपंजीकृत फ़ोन/ईमेल: '
                  : 'Please delete my DayFax account.\n\nRegistered phone/email: ';
              openExternalUri(
                AboutConfig.mailtoSupport(subject: subject, body: body),
              );
            },
          ),
          const SizedBox(height: CustomerSpacing.xl),
        ],
      ),
    );
  }
}
