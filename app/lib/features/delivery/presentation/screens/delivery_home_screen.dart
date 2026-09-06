import 'package:flutter/material.dart';

import '../../../../core/theme/delivery/delivery_colors.dart';
import '../../../../core/theme/delivery/delivery_spacing.dart';

class DeliveryHomeScreen extends StatelessWidget {
  const DeliveryHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: DeliveryColors.background,
      appBar: AppBar(
        title: const Text('Deliveries'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(DeliverySpacing.marginMobile),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Partner dashboard',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: DeliverySpacing.sm),
            Text(
              'Delivery list and assignment flows will land next. Theme uses Logistics Core.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DeliveryColors.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
