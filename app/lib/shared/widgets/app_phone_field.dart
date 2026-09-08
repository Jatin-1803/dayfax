import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/customer/customer_colors.dart';
import '../../core/theme/customer/customer_radius.dart';
import '../../core/theme/customer/customer_spacing.dart';
import '../../core/theme/delivery/delivery_colors.dart';
import '../../core/theme/delivery/delivery_radius.dart';
import '../../core/theme/delivery/delivery_spacing.dart';
import '../../core/theme/theme_surface.dart';

class AppPhoneField extends StatelessWidget {
  const AppPhoneField({
    super.key,
    required this.controller,
    this.onChanged,
    this.errorText,
    this.countryCode = '+91',
    this.hintText = '00000 00000',
  });

  final TextEditingController controller;
  final ValueChanged<String>? onChanged;
  final String? errorText;
  final String countryCode;
  final String hintText;

  @override
  Widget build(BuildContext context) {
    final delivery = isDeliveryTheme(context);
    final gap = delivery ? DeliverySpacing.sm : CustomerSpacing.sm;
    final errorColor = delivery ? DeliveryColors.error : CustomerColors.error;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (delivery)
          _DeliveryPhoneField(
            controller: controller,
            onChanged: onChanged,
            countryCode: countryCode,
            hintText: hintText,
          )
        else
          _CustomerPhoneField(
            controller: controller,
            onChanged: onChanged,
            countryCode: countryCode,
            hintText: hintText,
          ),
        if (errorText != null) ...[
          SizedBox(height: gap),
          Text(
            errorText!,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: errorColor),
          ),
        ],
      ],
    );
  }
}

class _CustomerPhoneField extends StatelessWidget {
  const _CustomerPhoneField({
    required this.controller,
    required this.countryCode,
    required this.hintText,
    this.onChanged,
  });

  final TextEditingController controller;
  final ValueChanged<String>? onChanged;
  final String countryCode;
  final String hintText;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: CustomerColors.inputFill,
        borderRadius: BorderRadius.circular(CustomerRadius.full),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: CustomerSpacing.sm),
      child: Row(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: CustomerSpacing.sm,
              vertical: CustomerSpacing.md,
            ),
            child: Text(countryCode, style: Theme.of(context).textTheme.bodyLarge),
          ),
          Container(
            width: 1,
            height: 28,
            color: CustomerColors.outlineVariant.withValues(alpha: 0.3),
          ),
          Expanded(
            child: TextField(
              controller: controller,
              onChanged: onChanged,
              keyboardType: TextInputType.phone,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(10),
              ],
              style: Theme.of(context).textTheme.bodyLarge,
              decoration: InputDecoration(
                hintText: hintText,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DeliveryPhoneField extends StatelessWidget {
  const _DeliveryPhoneField({
    required this.controller,
    required this.countryCode,
    required this.hintText,
    this.onChanged,
  });

  final TextEditingController controller;
  final ValueChanged<String>? onChanged;
  final String countryCode;
  final String hintText;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      decoration: BoxDecoration(
        color: DeliveryColors.surface,
        borderRadius: BorderRadius.circular(DeliveryRadius.md),
        border: Border.all(color: DeliveryColors.outline),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: DeliverySpacing.md),
            decoration: const BoxDecoration(
              color: DeliveryColors.surfaceContainerLow,
              borderRadius: BorderRadius.horizontal(
                left: Radius.circular(DeliveryRadius.md),
              ),
              border: Border(
                right: BorderSide(color: DeliveryColors.outline),
              ),
            ),
            alignment: Alignment.center,
            child: Text(countryCode, style: Theme.of(context).textTheme.bodyLarge),
          ),
          Expanded(
            child: TextField(
              controller: controller,
              onChanged: onChanged,
              keyboardType: TextInputType.phone,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(10),
              ],
              style: Theme.of(context).textTheme.bodyLarge,
              decoration: InputDecoration(
                hintText: hintText,
                hintStyle: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: DeliveryColors.onSurfaceVariant,
                    ),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: DeliverySpacing.md,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
