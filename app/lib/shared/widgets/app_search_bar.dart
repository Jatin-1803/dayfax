import 'package:flutter/material.dart';

import '../../core/i18n/i18n_providers.dart';
import '../../core/theme/customer/customer_colors.dart';
import '../../core/theme/customer/customer_radius.dart';
import '../../core/theme/customer/customer_spacing.dart';

class AppSearchBar extends StatelessWidget {
  const AppSearchBar({
    super.key,
    this.controller,
    this.focusNode,
    this.hintText,
    this.onChanged,
    this.onSubmitted,
    this.readOnly = false,
    this.autofocus = false,
    this.onTap,
  });

  final TextEditingController? controller;
  final FocusNode? focusNode;
  final String? hintText;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final bool readOnly;
  final bool autofocus;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      decoration: BoxDecoration(
        color: CustomerColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(CustomerRadius.full),
        border: Border.all(
          color: CustomerColors.outlineVariant.withValues(alpha: 0.55),
        ),
        boxShadow: [
          BoxShadow(
            color: CustomerColors.onSurface.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: CustomerSpacing.md),
      child: Row(
        children: [
          const Icon(Icons.search_rounded, color: CustomerColors.onSurfaceVariant, size: 22),
          const SizedBox(width: CustomerSpacing.sm),
          Expanded(
            child: TextField(
              controller: controller,
              focusNode: focusNode,
              autofocus: autofocus,
              onChanged: onChanged,
              onSubmitted: onSubmitted,
              readOnly: readOnly,
              onTap: onTap,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
              decoration: InputDecoration(
                hintText: hintText ?? context.t('catalog.search_hint'),
                hintStyle: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: CustomerColors.onSurfaceVariant,
                    ),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
