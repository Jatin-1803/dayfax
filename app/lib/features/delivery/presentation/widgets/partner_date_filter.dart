import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/delivery/delivery_colors.dart';
import '../../../../core/theme/delivery/delivery_radius.dart';
import '../../../../core/theme/delivery/delivery_spacing.dart';
import '../../domain/partner_day.dart';

class PartnerDateFilter extends StatelessWidget {
  const PartnerDateFilter({
    super.key,
    required this.selectedDate,
    required this.onChanged,
  });

  final String selectedDate;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final today = partnerToday();
    final yesterday = partnerYesterday();
    final custom = selectedDate != today && selectedDate != yesterday;
    final customLabel = custom ? _chipLabel(selectedDate) : context.t('delivery.pick_date');

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _DateChip(
            label: context.t('delivery.today'),
            selected: selectedDate == today,
            onTap: () => onChanged(today),
          ),
          const SizedBox(width: DeliverySpacing.sm),
          _DateChip(
            label: context.t('delivery.yesterday'),
            selected: selectedDate == yesterday,
            onTap: () => onChanged(yesterday),
          ),
          const SizedBox(width: DeliverySpacing.sm),
          _DateChip(
            label: customLabel,
            selected: custom,
            icon: Icons.calendar_today_outlined,
            onTap: () => _pickDate(context),
          ),
        ],
      ),
    );
  }

  Future<void> _pickDate(BuildContext context) async {
    final today = partnerTodayDate();
    final initial = parsePartnerDate(selectedDate) ?? today;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: today.subtract(const Duration(days: 365)),
      lastDate: today,
      helpText: context.t('delivery.pick_date'),
    );
    if (picked == null || !context.mounted) return;
    onChanged(formatPartnerDate(picked));
  }

  String _chipLabel(String date) {
    final parsed = parsePartnerDate(date);
    if (parsed == null) return date;
    return DateFormat('d MMM').format(parsed);
  }
}

class _DateChip extends StatelessWidget {
  const _DateChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.icon,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? DeliveryColors.primary : DeliveryColors.surfaceContainerLowest,
      borderRadius: BorderRadius.circular(DeliveryRadius.full),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(DeliveryRadius.full),
        child: Container(
          constraints: const BoxConstraints(minHeight: DeliverySpacing.touchTarget),
          padding: const EdgeInsets.symmetric(horizontal: DeliverySpacing.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(DeliveryRadius.full),
            border: Border.all(
              color: selected ? DeliveryColors.primary : DeliveryColors.cardBorder,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(
                  icon,
                  size: 16,
                  color: selected ? DeliveryColors.onPrimary : DeliveryColors.primary,
                ),
                const SizedBox(width: DeliverySpacing.xs),
              ],
              Text(
                label,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: selected ? DeliveryColors.onPrimary : DeliveryColors.deepSlate,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
