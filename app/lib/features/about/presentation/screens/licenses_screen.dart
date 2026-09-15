import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/about_config.dart';

/// Shows OSS licenses from the Flutter license registry (actual package deps).
class LicensesScreen extends ConsumerWidget {
  const LicensesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return LicensePage(
      applicationName: AboutConfig.appName,
      applicationVersion: '${AboutConfig.appVersion} (${AboutConfig.buildNumber})',
      applicationLegalese: AboutConfig.copyrightLine(),
      applicationIcon: Padding(
        padding: const EdgeInsets.all(CustomerSpacing.md),
        child: Icon(
          Icons.balance_outlined,
          size: 40,
          color: CustomerColors.primary,
          semanticLabel: ref.t('about.licenses'),
        ),
      ),
    );
  }
}
