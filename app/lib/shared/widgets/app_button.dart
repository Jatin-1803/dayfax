import 'package:flutter/material.dart';

import '../../core/theme/customer/customer_colors.dart';
import '../../core/theme/customer/customer_radius.dart';
import '../../core/theme/customer/customer_shadows.dart';
import '../../core/theme/customer/customer_spacing.dart';
import '../../core/theme/delivery/delivery_colors.dart';
import '../../core/theme/delivery/delivery_radius.dart';
import '../../core/theme/delivery/delivery_spacing.dart';
import '../../core/theme/theme_surface.dart';

enum AppButtonVariant { primary, secondary, outline }

class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
    this.variant = AppButtonVariant.primary,
    this.icon,
    this.expanded = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final AppButtonVariant variant;
  final IconData? icon;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !isLoading;
    final delivery = isDeliveryTheme(context);
    final radius = delivery ? DeliveryRadius.md : CustomerRadius.full;
    final gap = delivery ? DeliverySpacing.sm : CustomerSpacing.sm;
    final onPrimary = delivery ? DeliveryColors.onPrimary : CustomerColors.onPrimary;
    final primary = delivery ? DeliveryColors.primary : CustomerColors.primary;
    final primaryContainer =
        delivery ? DeliveryColors.primaryContainer : CustomerColors.primaryContainer;
    final minHeight = delivery ? 56.0 : 48.0;

    final child = Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: expanded ? MainAxisSize.max : MainAxisSize.min,
      children: [
        if (isLoading)
          SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2, color: onPrimary),
          )
        else ...[
          if (icon != null) ...[
            Icon(icon, size: 20),
            SizedBox(width: gap),
          ],
          Flexible(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                label,
                maxLines: 1,
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ],
      ],
    );

    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(radius),
    );

    final button = switch (variant) {
      AppButtonVariant.primary => DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(radius),
            boxShadow: enabled && !delivery ? CustomerShadows.level2 : null,
          ),
          child: FilledButton(
            onPressed: enabled ? onPressed : null,
            style: FilledButton.styleFrom(
              backgroundColor: primary,
              foregroundColor: onPrimary,
              minimumSize: Size.fromHeight(minHeight),
              shape: shape,
              elevation: 0,
            ),
            child: child,
          ),
        ),
      AppButtonVariant.secondary => FilledButton(
          onPressed: enabled ? onPressed : null,
          style: FilledButton.styleFrom(
            backgroundColor: primaryContainer.withValues(alpha: 0.15),
            foregroundColor: primary,
            minimumSize: Size.fromHeight(minHeight),
            shape: shape,
            elevation: 0,
          ),
          child: child,
        ),
      AppButtonVariant.outline => OutlinedButton(
          onPressed: enabled ? onPressed : null,
          style: OutlinedButton.styleFrom(
            foregroundColor: primary,
            side: BorderSide(color: primary, width: 1.5),
            minimumSize: Size.fromHeight(minHeight),
            shape: shape,
          ),
          child: child,
        ),
    };

    if (!expanded) return button;
    return SizedBox(width: double.infinity, child: button);
  }
}
