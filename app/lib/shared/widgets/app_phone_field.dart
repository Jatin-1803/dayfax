import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/customer/customer_colors.dart';
import '../../core/theme/customer/customer_radius.dart';
import '../../core/theme/customer/customer_spacing.dart';

class AppPhoneField extends StatelessWidget {
  const AppPhoneField({
    super.key,
    required this.controller,
    this.onChanged,
    this.errorText,
    this.countryCode = '+91',
  });

  final TextEditingController controller;
  final ValueChanged<String>? onChanged;
  final String? errorText;
  final String countryCode;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
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
                child: Row(
                  children: [
                    Text(
                      countryCode,
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                    const Icon(Icons.expand_more, size: 18, color: CustomerColors.onSurfaceVariant),
                  ],
                ),
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
                  decoration: const InputDecoration(
                    hintText: '00000 00000',
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    filled: false,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (errorText != null) ...[
          const SizedBox(height: CustomerSpacing.sm),
          Text(
            errorText!,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: CustomerColors.error),
          ),
        ],
      ],
    );
  }
}
