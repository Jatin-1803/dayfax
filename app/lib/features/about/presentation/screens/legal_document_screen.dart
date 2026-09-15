import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/i18n/app_locale.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../data/legal_content.dart';
import '../../data/legal_models.dart';
import '../widgets/legal_document_view.dart';

class LegalDocumentScreen extends ConsumerWidget {
  const LegalDocumentScreen({super.key, required this.documentId});

  final LegalDocumentId documentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeControllerProvider).value ?? AppLocale.en;
    final doc = LegalCatalog.document(documentId);

    return Scaffold(
      appBar: AppBar(title: Text(doc.title.resolve(locale))),
      body: LegalDocumentView(document: doc),
    );
  }
}
