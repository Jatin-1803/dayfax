import 'package:flutter/material.dart';

import '../../core/theme/customer/customer_colors.dart';
import '../../core/theme/customer/customer_radius.dart';
import '../../core/theme/customer/customer_spacing.dart';
import 'scale_on_tap.dart';

/// Pill quantity control with 44px minimum tap targets (Blinkit-style).
class QtyStepper extends StatelessWidget {
  const QtyStepper({
    super.key,
    required this.quantity,
    required this.onIncrement,
    required this.onDecrement,
    this.enabled = true,
    this.compact = false,
  });

  final int quantity;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final bool enabled;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final height = compact ? 28.0 : 44.0;
    final iconSize = compact ? 14.0 : 20.0;

    return Material(
      color: CustomerColors.primaryContainer,
      borderRadius: BorderRadius.circular(CustomerRadius.full),
      child: SizedBox(
        height: height,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _StepButton(
              icon: Icons.remove_rounded,
              onTap: enabled && quantity > 0 ? onDecrement : null,
              size: height,
              iconSize: iconSize,
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: CustomerSpacing.xs),
              child: Text(
                '$quantity',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: CustomerColors.onPrimaryContainer,
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ),
            _StepButton(
              icon: Icons.add_rounded,
              onTap: enabled ? onIncrement : null,
              size: height,
              iconSize: iconSize,
            ),
          ],
        ),
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({
    required this.icon,
    required this.onTap,
    required this.size,
    required this.iconSize,
  });

  final IconData icon;
  final VoidCallback? onTap;
  final double size;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(CustomerRadius.full),
      child: SizedBox(
        width: size,
        height: size,
        child: Icon(
          icon,
          size: iconSize,
          color: onTap == null
              ? CustomerColors.onPrimaryContainer.withValues(alpha: 0.4)
              : CustomerColors.onPrimaryContainer,
        ),
      ),
    );
  }
}

/// Circular add affordance that expands to [QtyStepper] when quantity &gt; 0.
class AddOrStepper extends StatelessWidget {
  const AddOrStepper({
    super.key,
    required this.quantity,
    required this.onAdd,
    required this.onIncrement,
    required this.onDecrement,
    this.enabled = true,
    this.compact = true,
  });

  final int quantity;
  final VoidCallback onAdd;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final bool enabled;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (quantity > 0) {
      return QtyStepper(
        quantity: quantity,
        onIncrement: onIncrement,
        onDecrement: onDecrement,
        enabled: enabled,
        compact: compact,
      );
    }

    final size = compact ? 28.0 : 48.0;
    return ScaleOnTap(
      onTap: enabled ? onAdd : null,
      child: Material(
        color: CustomerColors.primaryContainer,
        shape: const CircleBorder(),
        elevation: 0,
        child: SizedBox(
          width: size,
          height: size,
          child: Icon(
            Icons.add_rounded,
            size: compact ? 18 : 24,
            color: enabled
                ? CustomerColors.onPrimaryContainer
                : CustomerColors.onPrimaryContainer.withValues(alpha: 0.4),
          ),
        ),
      ),
    );
  }
}
