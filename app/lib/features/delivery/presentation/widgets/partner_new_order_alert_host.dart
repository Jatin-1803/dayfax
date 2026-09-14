import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../data/delivery_repository.dart';
import '../../domain/partner_new_order_alert.dart';
import '../delivery_view_models.dart';

final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

/// Full-screen new-order alert for delivery partners in the foreground.
class PartnerNewOrderAlertHost extends ConsumerStatefulWidget {
  const PartnerNewOrderAlertHost({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<PartnerNewOrderAlertHost> createState() => _PartnerNewOrderAlertHostState();
}

class _PartnerNewOrderAlertHostState extends ConsumerState<PartnerNewOrderAlertHost> {
  PartnerNewOrderAlert? _alert;
  String? _statusMessage;
  bool _unavailable = false;
  bool _accepting = false;
  Timer? _pulseTimer;
  Timer? _autoDismissTimer;

  @override
  void initState() {
    super.initState();
    partnerNewOrderAlert.addListener(_onAlertChanged);
    partnerOrderTakenSignal.addListener(_onTakenSignal);
    _alert = partnerNewOrderAlert.value;
    if (_alert != null) _startAttention();
  }

  @override
  void dispose() {
    partnerNewOrderAlert.removeListener(_onAlertChanged);
    partnerOrderTakenSignal.removeListener(_onTakenSignal);
    _stopAttention();
    super.dispose();
  }

  void _onAlertChanged() {
    final next = partnerNewOrderAlert.value;
    if (!mounted) return;
    setState(() {
      _alert = next;
      _statusMessage = null;
      _unavailable = false;
      _accepting = false;
    });
    if (next != null) {
      _startAttention();
    } else {
      _stopAttention();
    }
  }

  void _onTakenSignal() {
    final takenId = partnerOrderTakenSignal.value;
    final current = _alert;
    if (takenId == null || current == null || current.orderId != takenId) return;
    partnerOrderTakenSignal.value = null;
    _stopAttention();
    if (!mounted) return;
    setState(() {
      _unavailable = true;
      _statusMessage = ref.t('delivery.order_already_assigned');
    });
    _autoDismissTimer?.cancel();
    _autoDismissTimer = Timer(const Duration(seconds: 3), () {
      dismissPartnerNewOrderAlert(orderId: takenId);
    });
  }

  void _startAttention() {
    _stopAttention();
    unawaited(HapticFeedback.heavyImpact());
    unawaited(SystemSound.play(SystemSoundType.alert));
    _pulseTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      unawaited(HapticFeedback.mediumImpact());
      unawaited(SystemSound.play(SystemSoundType.alert));
    });
  }

  void _stopAttention() {
    _pulseTimer?.cancel();
    _pulseTimer = null;
    _autoDismissTimer?.cancel();
    _autoDismissTimer = null;
  }

  Future<void> _accept() async {
    final alert = _alert;
    if (alert == null || _accepting || _unavailable) return;
    setState(() {
      _accepting = true;
      _statusMessage = null;
    });
    try {
      // Always re-check via accept API — backend is authority.
      final job = await ref.read(deliveryRepositoryProvider).acceptOrder(alert.orderId);
      _stopAttention();
      invalidateDeliveryData(ref);
      dismissPartnerNewOrderAlert(orderId: alert.orderId);
      if (!mounted) return;
      context.go('/partner/jobs/${job.detailRouteId}');
    } on AppFailure catch (failure) {
      if (!mounted) return;
      final isAssigned =
          failure.message == 'delivery.order_already_assigned' ||
          failure.message == 'delivery.order_already_accepted' ||
          failure.message == 'delivery.order_not_available' ||
          failure.message == 'delivery.order_cancelled';
      final isNetwork = failure is NetworkFailure;
      setState(() {
        _accepting = false;
        _unavailable = isAssigned;
        _statusMessage = isNetwork
            ? ref.t('delivery.connection_problem')
            : ref.t(failure.message);
      });
      if (isAssigned) {
        _stopAttention();
        _autoDismissTimer?.cancel();
        _autoDismissTimer = Timer(const Duration(seconds: 3), () {
          dismissPartnerNewOrderAlert(orderId: alert.orderId);
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _accepting = false;
        _statusMessage = ref.t('delivery.connection_problem');
      });
    }
  }

  void _viewDetails() {
    final alert = _alert;
    if (alert == null) return;
    _stopAttention();
    dismissPartnerNewOrderAlert(orderId: alert.orderId);
    context.go('/partner/jobs/${alert.orderId}');
  }

  void _dismiss() {
    final alert = _alert;
    _stopAttention();
    dismissPartnerNewOrderAlert(orderId: alert?.orderId);
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(appRoleProvider);
    final show = role == AppRole.deliveryPartner && _alert != null;

    return Stack(
      children: [
        widget.child,
        if (show) _buildOverlay(context, _alert!),
      ],
    );
  }

  Widget _buildOverlay(BuildContext context, PartnerNewOrderAlert alert) {
    final amount = alert.amountPaise != null ? _inr.format(alert.amountPaise! / 100) : null;
    return Material(
      color: DeliveryColors.deepSlate.withValues(alpha: 0.72),
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(DeliverySpacing.lg),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: DeliveryColors.surfaceContainerLowest,
                  borderRadius: BorderRadius.circular(DeliveryRadius.lg),
                  border: Border.all(color: DeliveryColors.primaryContainer, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: DeliveryColors.deepSlate.withValues(alpha: 0.28),
                      blurRadius: 28,
                      offset: const Offset(0, 12),
                    ),
                  ],
                ),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    DeliverySpacing.lg,
                    DeliverySpacing.xl,
                    DeliverySpacing.lg,
                    DeliverySpacing.lg,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        ref.t('delivery.new_order_alert_title'),
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              color: DeliveryColors.primary,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.2,
                            ),
                      ),
                      const SizedBox(height: DeliverySpacing.sm),
                      Text(
                        ref.t('delivery.new_order_alert_order', {'orderNumber': alert.orderNumber}),
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              color: DeliveryColors.onSurface,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                      const SizedBox(height: DeliverySpacing.lg),
                      if (alert.storeName != null)
                        _InfoRow(
                          icon: Icons.storefront_rounded,
                          label: ref.t('delivery.new_order_pickup'),
                          value: alert.storeName!,
                        ),
                      if (alert.area != null)
                        _InfoRow(
                          icon: Icons.location_on_outlined,
                          label: ref.t('delivery.new_order_delivery_area'),
                          value: alert.area!,
                        ),
                      if (amount != null)
                        _InfoRow(
                          icon: Icons.payments_outlined,
                          label: ref.t('delivery.new_order_value'),
                          value: amount,
                        ),
                      _InfoRow(
                        icon: Icons.account_balance_wallet_outlined,
                        label: ref.t('delivery.new_order_payment'),
                        value: alert.isCod
                            ? ref.t('delivery.new_order_cod')
                            : ref.t('delivery.new_order_paid'),
                      ),
                      if (_statusMessage != null) ...[
                        const SizedBox(height: DeliverySpacing.md),
                        Container(
                          padding: const EdgeInsets.all(DeliverySpacing.md),
                          decoration: BoxDecoration(
                            color: _unavailable
                                ? DeliveryColors.errorContainer
                                : DeliveryColors.secondaryContainer,
                            borderRadius: BorderRadius.circular(DeliveryRadius.md),
                          ),
                          child: Text(
                            _statusMessage!,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: _unavailable
                                  ? DeliveryColors.onErrorContainer
                                  : DeliveryColors.onSecondaryContainer,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: DeliverySpacing.xl),
                      if (!_unavailable) ...[
                        AppButton(
                          label: ref.t('delivery.accept'),
                          onPressed: _accepting ? null : _accept,
                          isLoading: _accepting,
                        ),
                        const SizedBox(height: DeliverySpacing.sm),
                        AppButton(
                          label: ref.t('delivery.view_details'),
                          onPressed: _accepting ? null : _viewDetails,
                          variant: AppButtonVariant.outline,
                        ),
                        TextButton(
                          onPressed: _accepting ? null : _dismiss,
                          child: Text(ref.t('delivery.dismiss_alert')),
                        ),
                      ] else
                        AppButton(
                          label: ref.t('delivery.dismiss_alert'),
                          onPressed: _dismiss,
                          variant: AppButtonVariant.outline,
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: DeliverySpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: DeliveryColors.primary, size: 22),
          const SizedBox(width: DeliverySpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: DeliveryColors.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: DeliveryColors.onSurface,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
