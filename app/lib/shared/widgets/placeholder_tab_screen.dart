import 'package:flutter/material.dart';

import '../../../../shared/widgets/state_widgets.dart';

class PlaceholderTabScreen extends StatelessWidget {
  const PlaceholderTabScreen({
    super.key,
    required this.title,
    required this.message,
  });

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: EmptyState(
        title: title,
        message: message,
        icon: Icons.construction_outlined,
      ),
    );
  }
}
