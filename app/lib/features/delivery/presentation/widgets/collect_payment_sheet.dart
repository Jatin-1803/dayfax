import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/delivery/delivery_colors.dart';
import '../../../../core/theme/delivery/delivery_radius.dart';
import '../../../../core/theme/delivery/delivery_spacing.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../data/delivery_repository.dart';
import '../../domain/delivery_models.dart';

final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

String formatDeliveryPaise(int paise) => _inr.format(paise / 100);

enum CollectPaymentMode { qr, cash }

class CollectPaymentSheet extends ConsumerStatefulWidget {
  const CollectPaymentSheet({
    super.key,
    required this.orderId,
    required this.amountPaise,
    this.initialMode = CollectPaymentMode.qr,
  });

  final String orderId;
  final int amountPaise;
  final CollectPaymentMode initialMode;

  @override
  ConsumerState<CollectPaymentSheet> createState() => _CollectPaymentSheetState();
}

class _CollectPaymentSheetState extends ConsumerState<CollectPaymentSheet> {
  PaymentQrSession? _session;
  String? _errorKey;
  String _statusKey = 'delivery.waiting_payment';
  bool _loadingQr = false;
  bool _checking = false;
  bool _confirmingCash = false;
  bool _paid = false;
  Timer? _poll;
  int _pollAttempt = 0;
  late CollectPaymentMode _mode;

  static const _backoffMs = [4000, 8000, 15000, 15000, 15000];

  @override
  void initState() {
    super.initState();
    _mode = widget.initialMode;
    if (_mode == CollectPaymentMode.qr) {
      _loadQr();
    }
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  void _selectMode(CollectPaymentMode mode) {
    if (_paid || _confirmingCash || _mode == mode) return;
    setState(() {
      _mode = mode;
      _errorKey = null;
    });
    if (mode == CollectPaymentMode.qr) {
      if (_session == null && !_loadingQr) {
        _loadQr();
      } else if (_session != null && !_paid) {
        _schedulePoll();
      }
    }
  }

  Future<void> _loadQr() async {
    setState(() {
      _loadingQr = true;
      _errorKey = null;
    });
    try {
      final session = await ref.read(deliveryRepositoryProvider).createPaymentQr(widget.orderId);
      if (!mounted) return;
      if (session.status == 'CAPTURED') {
        _markPaid();
        return;
      }
      setState(() {
        _session = session;
        _loadingQr = false;
        _statusKey = 'delivery.waiting_payment';
      });
      _schedulePoll();
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _loadingQr = false;
        _errorKey = failure.message;
        _statusKey = 'delivery.payment_delayed';
      });
    }
  }

  void _markPaid() {
    _poll?.cancel();
    setState(() {
      _paid = true;
      _loadingQr = false;
      _checking = false;
      _confirmingCash = false;
      _statusKey = 'delivery.payment_received';
    });
  }

  void _schedulePoll() {
    _poll?.cancel();
    if (_paid || _pollAttempt >= _backoffMs.length) return;
    final delay = _backoffMs[_pollAttempt];
    _pollAttempt += 1;
    _poll = Timer(Duration(milliseconds: delay), () async {
      if (!mounted || _checking || _paid || _mode != CollectPaymentMode.qr) return;
      await _check(automatic: true);
      if (mounted && !_paid) _schedulePoll();
    });
  }

  Future<void> _check({bool automatic = false}) async {
    if (_checking || _paid) return;
    setState(() {
      _checking = true;
      if (!automatic) _statusKey = 'delivery.checking_payment';
      _errorKey = null;
    });
    try {
      final result = await ref.read(deliveryRepositoryProvider).checkPayment(widget.orderId);
      if (!mounted) return;
      if (result.status == 'CAPTURED') {
        _markPaid();
        return;
      }
      setState(() {
        _checking = false;
        _statusKey = result.status == 'FAILED'
            ? 'delivery.payment_verify_failed'
            : 'delivery.payment_still_pending';
      });
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _checking = false;
        _errorKey = failure.message;
        _statusKey = 'delivery.payment_verify_failed';
      });
    }
  }

  Future<void> _confirmCash() async {
    if (_confirmingCash || _paid) return;
    setState(() {
      _confirmingCash = true;
      _errorKey = null;
    });
    try {
      final result = await ref.read(deliveryRepositoryProvider).collectCash(widget.orderId);
      if (!mounted) return;
      if (result.status == 'CAPTURED') {
        _markPaid();
        return;
      }
      setState(() {
        _confirmingCash = false;
        _errorKey = 'delivery.payment_verify_failed';
      });
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _confirmingCash = false;
        _errorKey = failure.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final amount = formatDeliveryPaise(widget.amountPaise);
    final busy = _checking || _confirmingCash;
    return Padding(
      padding: EdgeInsets.only(
        left: DeliverySpacing.lg,
        right: DeliverySpacing.lg,
        top: DeliverySpacing.lg,
        bottom: MediaQuery.viewInsetsOf(context).bottom + DeliverySpacing.lg,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              context.t(_paid ? 'delivery.payment_received' : 'delivery.collect_method'),
              style: Theme.of(context).textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: DeliverySpacing.sm),
            Text(
              amount,
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: DeliveryColors.primary,
                    fontWeight: FontWeight.w700,
                  ),
              textAlign: TextAlign.center,
            ),
            if (!_paid) ...[
              const SizedBox(height: DeliverySpacing.md),
              _CollectModeToggle(
                mode: _mode,
                enabled: !busy,
                onChanged: _selectMode,
              ),
            ],
            const SizedBox(height: DeliverySpacing.md),
            if (_mode == CollectPaymentMode.qr && !_paid) ...[
              if (_loadingQr)
                const Padding(
                  padding: EdgeInsets.all(DeliverySpacing.xl),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_session?.imageUrl != null)
                Center(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(DeliveryRadius.md),
                    child: Image.network(
                      _session!.imageUrl!,
                      width: 220,
                      height: 220,
                      fit: BoxFit.contain,
                      errorBuilder: (_, _, _) => Text(context.t('delivery.payment_delayed')),
                    ),
                  ),
                ),
              const SizedBox(height: DeliverySpacing.md),
              Text(
                context.t(_statusKey),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ] else if (_mode == CollectPaymentMode.cash && !_paid) ...[
              Text(
                context.t('delivery.cash_received_title'),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: DeliverySpacing.sm),
              Text(
                context.t('delivery.cash_received_message', {'amount': amount}),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DeliveryColors.onSurfaceVariant,
                    ),
              ),
            ],
            if (_errorKey != null) ...[
              const SizedBox(height: DeliverySpacing.sm),
              Text(
                context.t(_errorKey!),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DeliveryColors.error,
                    ),
              ),
            ],
            const SizedBox(height: DeliverySpacing.md),
            if (_paid)
              AppButton(
                label: context.t('delivery.continue_otp'),
                onPressed: () => Navigator.of(context).pop(true),
              )
            else if (_mode == CollectPaymentMode.cash) ...[
              AppButton(
                label: context.t('delivery.confirm_cash'),
                icon: Icons.payments_outlined,
                isLoading: _confirmingCash,
                onPressed: busy ? null : _confirmCash,
              ),
              const SizedBox(height: DeliverySpacing.sm),
              AppButton(
                label: context.t('common.cancel'),
                variant: AppButtonVariant.outline,
                onPressed: busy ? null : () => Navigator.of(context).pop(false),
              ),
            ] else ...[
              AppButton(
                label: context.t('delivery.check_payment'),
                isLoading: _checking,
                onPressed: busy ? null : () => _check(),
              ),
              const SizedBox(height: DeliverySpacing.sm),
              AppButton(
                label: context.t('common.cancel'),
                variant: AppButtonVariant.outline,
                onPressed: busy ? null : () => Navigator.of(context).pop(false),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CollectModeToggle extends StatelessWidget {
  const _CollectModeToggle({
    required this.mode,
    required this.enabled,
    required this.onChanged,
  });

  final CollectPaymentMode mode;
  final bool enabled;
  final ValueChanged<CollectPaymentMode> onChanged;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: DeliveryColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(DeliveryRadius.md),
      ),
      child: Padding(
        padding: const EdgeInsets.all(DeliverySpacing.xs),
        child: Row(
          children: [
            Expanded(
              child: _ModeChip(
                label: context.t('delivery.pay_with_qr'),
                icon: Icons.qr_code_2,
                selected: mode == CollectPaymentMode.qr,
                enabled: enabled,
                onTap: () => onChanged(CollectPaymentMode.qr),
              ),
            ),
            const SizedBox(width: DeliverySpacing.xs),
            Expanded(
              child: _ModeChip(
                label: context.t('delivery.pay_with_cash'),
                icon: Icons.payments_outlined,
                selected: mode == CollectPaymentMode.cash,
                enabled: enabled,
                onTap: () => onChanged(CollectPaymentMode.cash),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ModeChip extends StatelessWidget {
  const _ModeChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final foreground = selected ? DeliveryColors.onPrimary : DeliveryColors.onSurface;
    return Material(
      color: selected ? DeliveryColors.primary : Colors.transparent,
      borderRadius: BorderRadius.circular(DeliveryRadius.sm),
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(DeliveryRadius.sm),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: DeliverySpacing.sm),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: foreground),
              const SizedBox(width: DeliverySpacing.xs),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: foreground,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
