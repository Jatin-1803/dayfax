import 'package:flutter/material.dart';

import '../../core/i18n/i18n_providers.dart';
import '../../core/theme/customer/customer_colors.dart';
import '../../core/theme/customer/customer_radius.dart';
import '../../core/theme/customer/customer_spacing.dart';
import '../../core/theme/delivery/delivery_colors.dart';
import '../../core/theme/delivery/delivery_radius.dart';
import '../../core/theme/delivery/delivery_spacing.dart';
import '../../core/theme/theme_surface.dart';

class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.status,
    this.label,
  });

  final String status;
  final String? label;

  /// Returns an i18n key for [status], or the raw status when unknown.
  static String displayLabel(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return 'status.pending';
      case 'CONFIRMED':
        return 'status.confirmed';
      case 'PREPARING':
        return 'status.preparing';
      case 'READY_FOR_PICKUP':
        return 'status.ready';
      case 'PICKED_UP':
        return 'status.picked_up';
      case 'OUT_FOR_DELIVERY':
        return 'status.on_the_way';
      case 'DELIVERED':
        return 'status.delivered';
      case 'CANCELLED':
        return 'status.cancelled';
      case 'ASSIGNED':
        return 'status.assigned';
      case 'ACCEPTED':
        return 'status.accepted';
      case 'IN_PROGRESS':
        return 'status.in_progress';
      case 'COMPLETED':
        return 'status.completed';
      case 'REJECTED':
        return 'status.rejected';
      default:
        return status;
    }
  }

  static ({Color bg, Color fg}) colorsFor(String status, {required bool delivery}) {
    if (delivery) {
      switch (status.toUpperCase()) {
        case 'DELIVERED':
        case 'COMPLETED':
          return (
            bg: DeliveryColors.primaryContainer.withValues(alpha: 0.2),
            fg: DeliveryColors.primary,
          );
        case 'OUT_FOR_DELIVERY':
        case 'PICKED_UP':
        case 'IN_PROGRESS':
          return (
            bg: DeliveryColors.secondaryContainer.withValues(alpha: 0.45),
            fg: DeliveryColors.onSecondaryContainer,
          );
        case 'CANCELLED':
        case 'REJECTED':
          return (bg: DeliveryColors.errorContainer, fg: DeliveryColors.onErrorContainer);
        case 'PENDING':
        case 'READY_FOR_PICKUP':
          return (
            bg: DeliveryColors.surfaceContainerHigh,
            fg: DeliveryColors.onSurfaceVariant,
          );
        default:
          return (
            bg: DeliveryColors.primary.withValues(alpha: 0.1),
            fg: DeliveryColors.primary,
          );
      }
    }

    switch (status.toUpperCase()) {
      case 'DELIVERED':
      case 'COMPLETED':
        return (
          bg: CustomerColors.primaryContainer.withValues(alpha: 0.25),
          fg: CustomerColors.primary,
        );
      case 'OUT_FOR_DELIVERY':
      case 'PICKED_UP':
      case 'IN_PROGRESS':
        return (
          bg: CustomerColors.secondaryContainer.withValues(alpha: 0.35),
          fg: CustomerColors.onSecondaryContainer,
        );
      case 'CANCELLED':
      case 'REJECTED':
        return (bg: CustomerColors.errorContainer, fg: CustomerColors.onErrorContainer);
      case 'PENDING':
        return (bg: CustomerColors.surfaceContainerHigh, fg: CustomerColors.onSurfaceVariant);
      default:
        return (bg: CustomerColors.primary.withValues(alpha: 0.1), fg: CustomerColors.primary);
    }
  }

  @override
  Widget build(BuildContext context) {
    final delivery = isDeliveryTheme(context);
    final colors = colorsFor(status, delivery: delivery);
    final hPad = delivery ? DeliverySpacing.sm + 2 : CustomerSpacing.sm + 2;
    final vPad = delivery ? DeliverySpacing.xs : CustomerSpacing.xs;
    final radius = delivery ? DeliveryRadius.md : CustomerRadius.full;

    return Container(
      padding: EdgeInsets.symmetric(horizontal: hPad, vertical: vPad),
      decoration: BoxDecoration(
        color: colors.bg,
        borderRadius: BorderRadius.circular(radius),
      ),
      child: Text(
        label ?? context.t(displayLabel(status)),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: colors.fg,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}
