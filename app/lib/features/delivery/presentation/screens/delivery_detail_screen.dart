import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/delivery/delivery_colors.dart';
import '../../../../core/theme/delivery/delivery_radius.dart';
import '../../../../core/theme/delivery/delivery_spacing.dart';
import '../../../../core/utils/partner_navigation.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../data/delivery_repository.dart';
import '../../domain/delivery_models.dart';
import '../delivery_view_models.dart';
import '../widgets/collect_payment_sheet.dart';

class DeliveryDetailScreen extends ConsumerStatefulWidget {
  const DeliveryDetailScreen({super.key, required this.idOrOrderId});

  final String idOrOrderId;

  @override
  ConsumerState<DeliveryDetailScreen> createState() => _DeliveryDetailScreenState();
}

class _DeliveryDetailScreenState extends ConsumerState<DeliveryDetailScreen>
    with WidgetsBindingObserver {
  bool _isSubmitting = false;
  String? _actionError;
  String? _paymentStatusKey;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(deliveryJobDetailProvider(widget.idOrOrderId).notifier).load();
    }
  }

  Future<void> _runAction(Future<DeliveryJob> Function() action) async {
    if (_isSubmitting) return;
    setState(() {
      _isSubmitting = true;
      _actionError = null;
    });
    try {
      await action();
      invalidateDeliveryData(ref);
      await ref.read(deliveryJobDetailProvider(widget.idOrOrderId).notifier).load();
      if (!mounted) return;
      setState(() => _isSubmitting = false);
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _actionError = failure.message;
      });
    }
  }

  Future<void> _acceptOrder(DeliveryJob job) {
    if (job.isReturnPickup && job.returnRequestId != null) {
      return _runAction(
        () => ref.read(deliveryRepositoryProvider).acceptReturn(job.returnRequestId!),
      );
    }
    return _runAction(() => ref.read(deliveryRepositoryProvider).acceptOrder(job.orderId));
  }

  Future<void> _acceptAssigned(DeliveryJob job) {
    if (job.isReturnPickup && job.returnRequestId != null) {
      return _runAction(
        () => ref.read(deliveryRepositoryProvider).acceptReturn(job.returnRequestId!),
      );
    }
    final assignmentId = job.assignment!.id;
    return _runAction(() => ref.read(deliveryRepositoryProvider).acceptJob(assignmentId));
  }

  Future<void> _startDelivery(DeliveryJob job) {
    final assignmentId = job.assignment!.id;
    return _runAction(
      () => ref.read(deliveryRepositoryProvider).updateStatus(
            assignmentId: assignmentId,
            status: 'IN_PROGRESS',
          ),
    );
  }

  Future<void> _reject(DeliveryJob job) async {
    final note = await _showNoteDialog(
      title: ref.tr(job.isReturnPickup ? 'delivery.reject_pickup_title' : 'delivery.reject_title'),
      message: ref.tr(job.isReturnPickup ? 'delivery.reject_pickup_message' : 'delivery.reject_message'),
      confirmLabel: ref.tr('delivery.reject'),
      destructive: true,
    );
    if (note == null || !mounted) return;
    final assignmentId = job.assignment!.id;
    await _runAction(
      () => ref.read(deliveryRepositoryProvider).updateStatus(
            assignmentId: assignmentId,
            status: 'REJECTED',
            note: note.isEmpty ? null : note,
          ),
    );
    if (!mounted || _actionError != null) return;
    context.pop();
  }

  Future<void> _complete(DeliveryJob job) async {
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      isDismissible: false,
      enableDrag: false,
      backgroundColor: DeliveryColors.surfaceContainerLowest,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(DeliveryRadius.lg)),
      ),
      builder: (sheetContext) => _ConfirmDeliverySheet(job: job),
    );
    if (confirmed != true || !mounted) return;
    context.go('/partner/jobs/${job.detailRouteId}/success');
  }

  Future<void> _collectPayment(DeliveryJob job, {CollectPaymentMode mode = CollectPaymentMode.qr}) async {
    if (!job.needsCodCollection) return;
    final paid = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: DeliveryColors.surfaceContainerLowest,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(DeliveryRadius.lg)),
      ),
      builder: (sheetContext) => CollectPaymentSheet(
        orderId: job.orderId,
        amountPaise: job.payment?.collectAmountPaise ?? job.grandTotalPaise,
        initialMode: mode,
      ),
    );
    invalidateDeliveryData(ref);
    await ref.read(deliveryJobDetailProvider(widget.idOrOrderId).notifier).load();
    if (!mounted) return;
    if (paid == true) {
      setState(() => _paymentStatusKey = 'delivery.payment_received');
      final updated = ref.read(deliveryJobDetailProvider(widget.idOrOrderId)).value;
      if (updated != null && updated.otpAllowed) {
        await _complete(updated);
      }
    }
  }

  Future<void> _checkPayment(DeliveryJob job) async {
    if (_isSubmitting) return;
    setState(() {
      _isSubmitting = true;
      _actionError = null;
      _paymentStatusKey = 'delivery.checking_payment';
    });
    try {
      final result = await ref.read(deliveryRepositoryProvider).checkPayment(job.orderId);
      invalidateDeliveryData(ref);
      await ref.read(deliveryJobDetailProvider(widget.idOrOrderId).notifier).load();
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _paymentStatusKey = switch (result.status) {
          'CAPTURED' => 'delivery.payment_received',
          'FAILED' => 'delivery.payment_verify_failed',
          _ => 'delivery.payment_still_pending',
        };
      });
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _actionError = failure.message;
        _paymentStatusKey = 'delivery.payment_verify_failed';
      });
    }
  }

  Future<void> _openMap(DeliveryJob job) async {
    final opened = await PartnerNavigation.openCustomerMap(job.address);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.tr('delivery.maps_failed'))),
      );
    }
  }

  Future<void> _openShopMap(DeliveryStore store) async {
    final opened = await PartnerNavigation.openShopMap(store);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.tr('delivery.maps_failed'))),
      );
    }
  }

  Future<void> _callCustomer(DeliveryJob job) async {
    final customer = job.customer;
    if (customer == null) return;
    final opened = await PartnerNavigation.callCustomer(customer);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.tr('delivery.call_failed'))),
      );
    }
  }

  Future<void> _callShop(DeliveryStore store) async {
    final opened = await PartnerNavigation.callShop(store);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.tr('delivery.call_failed'))),
      );
    }
  }

  Future<String?> _showNoteDialog({
    required String title,
    required String message,
    required String confirmLabel,
    bool destructive = false,
  }) {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(message),
            const SizedBox(height: DeliverySpacing.md),
            TextField(
              controller: controller,
              maxLength: 255,
              decoration: InputDecoration(
                labelText: context.t('delivery.note_optional'),
                border: const OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(null),
            child: Text(context.t('common.cancel')),
          ),
          FilledButton(
            style: destructive
                ? FilledButton.styleFrom(backgroundColor: DeliveryColors.error)
                : null,
            onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            child: Text(confirmLabel),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final asyncJob = ref.watch(deliveryJobDetailProvider(widget.idOrOrderId));

    return Scaffold(
      backgroundColor: DeliveryColors.background,
      appBar: AppBar(
        title: Text(
          asyncJob.maybeWhen(
            data: (job) => ref.t(
              job.isReturnPickup ? 'delivery.return_pickup_title' : 'delivery.order_details',
            ),
            orElse: () => ref.t('delivery.order_details'),
          ),
        ),
      ),
      body: asyncJob.when(
        loading: () => const OrderDetailSkeleton(),
        error: (error, _) => ErrorState(
          message: error is AppFailure ? error.message : 'delivery.could_not_load',
          onRetry: () =>
              ref.read(deliveryJobDetailProvider(widget.idOrOrderId).notifier).load(),
        ),
        data: (job) => _DeliveryDetailBody(
          job: job,
          isSubmitting: _isSubmitting,
          actionError: _actionError,
          paymentStatusKey: _paymentStatusKey,
          onAcceptOrder: () => _acceptOrder(job),
          onAcceptAssigned: () => _acceptAssigned(job),
          onStart: () => _startDelivery(job),
          onComplete: () => _complete(job),
          onCollectPayment: () => _collectPayment(job),
          onCollectCash: () => _collectPayment(job, mode: CollectPaymentMode.cash),
          onCheckPayment: () => _checkPayment(job),
          onReject: () => _reject(job),
          onOpenMap: () => _openMap(job),
          onOpenShopMap: () => _openShopMap(job.store),
          onCallCustomer: () => _callCustomer(job),
          onCallShop: () => _callShop(job.store),
          onOpenLocalShopMap: job.localShop == null
              ? null
              : () => _openShopMap(job.localShop!),
          onCallLocalShop: job.localShop == null
              ? null
              : () => _callShop(job.localShop!),
        ),
      ),
    );
  }
}

class _ConfirmDeliverySheet extends ConsumerStatefulWidget {
  const _ConfirmDeliverySheet({required this.job});

  final DeliveryJob job;

  @override
  ConsumerState<_ConfirmDeliverySheet> createState() => _ConfirmDeliverySheetState();
}

class _ConfirmDeliverySheetState extends ConsumerState<_ConfirmDeliverySheet> {
  final List<TextEditingController> _controllers =
      List.generate(4, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(4, (_) => FocusNode());
  String? _errorKey;
  Map<String, String>? _errorParams;
  bool _isSubmitting = false;
  bool _locked = false;

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  String get _otp => _controllers.map((c) => c.text).join();

  bool get _isComplete => _otp.length == 4 && RegExp(r'^\d{4}$').hasMatch(_otp);

  bool get _canEdit => !_isSubmitting && !_locked;

  void _onDigitChanged(int index, String value) {
    if (!_canEdit) return;
    if (value.replaceAll(RegExp(r'\D'), '').isNotEmpty) {
      _errorKey = null;
      _errorParams = null;
    }
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.length > 1) {
      for (var i = 0; i < 4; i++) {
        _controllers[i].text = i < digits.length ? digits[i] : '';
      }
      final focusIndex = digits.length.clamp(0, 3);
      _focusNodes[focusIndex].requestFocus();
      setState(() {});
      return;
    }
    if (digits.isNotEmpty && index < 3) {
      _focusNodes[index + 1].requestFocus();
    }
    setState(() {});
  }

  void _clearOtp() {
    for (final controller in _controllers) {
      controller.clear();
    }
    _focusNodes.first.requestFocus();
  }

  void _showError(String key, {Map<String, String>? params, bool lock = false}) {
    setState(() {
      _isSubmitting = false;
      _locked = lock;
      _errorKey = key;
      _errorParams = params;
    });
    if (!lock) _clearOtp();
  }

  Future<void> _submit() async {
    if (_isSubmitting || _locked) return;
    if (!_isComplete) {
      setState(() {
        _errorKey = 'delivery.otp_incomplete';
        _errorParams = null;
      });
      return;
    }
    final assignmentId = widget.job.assignment?.id;
    if (assignmentId == null) return;

    setState(() {
      _isSubmitting = true;
      _errorKey = null;
      _errorParams = null;
    });
    try {
      await ref.read(deliveryRepositoryProvider).updateStatus(
            assignmentId: assignmentId,
            status: 'COMPLETED',
            deliveryOtp: _otp,
          );
      if (!mounted) return;
      invalidateDeliveryData(ref);
      Navigator.of(context).pop(true);
    } on AppFailure catch (failure) {
      if (!mounted) return;
      final locked = failure.message == 'delivery.otp_attempts_exhausted';
      _showError(
        failure.message,
        params: failure is ValidationFailure ? failure.params : null,
        lock: locked,
      );
    } catch (_) {
      if (!mounted) return;
      _showError('error.generic');
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    final viewInsets = MediaQuery.viewInsetsOf(context).bottom;
    final errorBorder = OutlineInputBorder(
      borderSide: BorderSide(color: DeliveryColors.error),
    );
    return PopScope(
      canPop: !_isSubmitting,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          DeliverySpacing.marginMobile,
          DeliverySpacing.md,
          DeliverySpacing.marginMobile,
          DeliverySpacing.marginMobile + bottom + viewInsets,
        ),
        child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: DeliveryColors.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(DeliveryRadius.full),
              ),
            ),
          ),
          const SizedBox(height: DeliverySpacing.lg),
          Text(
            context.t(widget.job.confirmTitleKey),
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: DeliverySpacing.sm),
          Text(
            context.t(
              widget.job.isReturnPickup
                  ? 'delivery.pickup_code_prompt'
                  : 'delivery.otp_required',
            ),
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: DeliveryColors.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: DeliverySpacing.xs),
          Text(
            context.t('delivery.otp_attempt_limit'),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DeliveryColors.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: DeliverySpacing.md),
          Container(
            padding: const EdgeInsets.all(DeliverySpacing.md),
            decoration: BoxDecoration(
              color: DeliveryColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(DeliveryRadius.md),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.job.isReturnPickup
                      ? context.t(widget.job.listTitleKey, {'orderNumber': widget.job.orderNumber})
                      : widget.job.orderNumber,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                if (widget.job.customerName != null) ...[
                  const SizedBox(height: DeliverySpacing.xs),
                  Text(widget.job.customerName!),
                ],
                const SizedBox(height: DeliverySpacing.xs),
                Text(widget.job.address.summary),
                if (widget.job.isReturnPickup && widget.job.collectItems.isNotEmpty) ...[
                  const SizedBox(height: DeliverySpacing.sm),
                  for (final item in widget.job.collectItems)
                    Padding(
                      padding: const EdgeInsets.only(top: DeliverySpacing.xs),
                      child: Text(item.displayLine),
                    ),
                ],
              ],
            ),
          ),
          const SizedBox(height: DeliverySpacing.lg),
          Text(
            context.t(widget.job.confirmCodeLabelKey),
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: DeliverySpacing.sm),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(4, (index) {
              return SizedBox(
                width: 64,
                child: TextField(
                  controller: _controllers[index],
                  focusNode: _focusNodes[index],
                  autofocus: index == 0,
                  enabled: _canEdit,
                  textAlign: TextAlign.center,
                  keyboardType: TextInputType.number,
                  maxLength: index == 0 ? 4 : 1,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                  decoration: InputDecoration(
                    counterText: '',
                    border: const OutlineInputBorder(),
                    enabledBorder: _errorKey == null ? null : errorBorder,
                    focusedBorder: _errorKey == null ? null : errorBorder,
                  ),
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  onChanged: (value) => _onDigitChanged(index, value),
                  onTap: () {
                    _controllers[index].selection = TextSelection(
                      baseOffset: 0,
                      extentOffset: _controllers[index].text.length,
                    );
                  },
                ),
              );
            }),
          ),
          if (_errorKey != null) ...[
            const SizedBox(height: DeliverySpacing.sm),
            Text(
              context.t(_errorKey!, _errorParams),
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DeliveryColors.error,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
          const SizedBox(height: DeliverySpacing.lg),
          AppButton(
            label: context.t(
              widget.job.isReturnPickup ? 'delivery.confirm_pickup' : 'delivery.mark_delivered',
            ),
            isLoading: _isSubmitting,
            onPressed: _canEdit && _isComplete ? _submit : null,
          ),
          const SizedBox(height: DeliverySpacing.sm),
          AppButton(
            label: context.t('common.cancel'),
            variant: AppButtonVariant.outline,
            onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(false),
          ),
        ],
      ),
    ),
    );
  }
}

class _DeliveryDetailBody extends StatelessWidget {
  const _DeliveryDetailBody({
    required this.job,
    required this.isSubmitting,
    required this.actionError,
    required this.paymentStatusKey,
    required this.onAcceptOrder,
    required this.onAcceptAssigned,
    required this.onStart,
    required this.onComplete,
    required this.onCollectPayment,
    required this.onCollectCash,
    required this.onCheckPayment,
    required this.onReject,
    required this.onOpenMap,
    required this.onOpenShopMap,
    required this.onCallCustomer,
    required this.onCallShop,
    this.onOpenLocalShopMap,
    this.onCallLocalShop,
  });

  final DeliveryJob job;
  final bool isSubmitting;
  final String? actionError;
  final String? paymentStatusKey;
  final VoidCallback onAcceptOrder;
  final VoidCallback onAcceptAssigned;
  final VoidCallback onStart;
  final VoidCallback onComplete;
  final VoidCallback onCollectPayment;
  final VoidCallback onCollectCash;
  final VoidCallback onCheckPayment;
  final VoidCallback onReject;
  final VoidCallback onOpenMap;
  final VoidCallback onOpenShopMap;
  final VoidCallback onCallCustomer;
  final VoidCallback onCallShop;
  final VoidCallback? onOpenLocalShopMap;
  final VoidCallback? onCallLocalShop;

  @override
  Widget build(BuildContext context) {
    if (job.isReturnPickup) {
      return _returnBody(context);
    }
    return _deliveryBody(context);
  }

  Widget _returnBody(BuildContext context) {
    final dateFormat = DateFormat('dd MMM yyyy, hh:mm a');
    final note = job.returnNote?.trim();

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(DeliverySpacing.marginMobile),
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(DeliverySpacing.md),
                decoration: BoxDecoration(
                  color: DeliveryColors.primaryContainer,
                  borderRadius: BorderRadius.circular(DeliveryRadius.lg),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.t('delivery.return_pickup_badge'),
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            color: DeliveryColors.onPrimaryContainer,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    const SizedBox(height: DeliverySpacing.xs),
                    Text(
                      context.t(job.listTitleKey, {'orderNumber': job.orderNumber}),
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: DeliveryColors.onPrimaryContainer,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    const SizedBox(height: DeliverySpacing.xs),
                    Text(
                      context.t('delivery.return_pickup'),
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: DeliveryColors.onPrimaryContainer,
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: DeliverySpacing.sm),
              Text(
                dateFormat.format(job.placedAt.toLocal()),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DeliveryColors.onSurfaceVariant,
                    ),
              ),
              if (job.assignment != null) ...[
                const SizedBox(height: DeliverySpacing.sm),
                StatusChip(status: job.assignment!.status),
              ],
              const SizedBox(height: DeliverySpacing.lg),
              Text(
                context.t('delivery.collect_items'),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: DeliverySpacing.sm),
              if (job.collectItems.isEmpty)
                Text(
                  context.t('delivery.no_items'),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DeliveryColors.onSurfaceVariant,
                      ),
                )
              else
                _JobItems(items: job.items.isNotEmpty
                    ? job.items
                    : job.collectItems
                        .map(
                          (item) => DeliveryJobItem(
                            id: item.productName,
                            productName: item.productName,
                            variantLabel: item.variantLabel ?? '',
                            unitPricePaise: 0,
                            quantity: item.quantity,
                            lineTotalPaise: 0,
                          ),
                        )
                        .toList()),
              const SizedBox(height: DeliverySpacing.lg),
              Text(
                context.t(job.addressLabelKey),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: DeliverySpacing.sm),
              _InfoCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (job.customerName != null)
                      Text(job.customerName!, style: Theme.of(context).textTheme.titleSmall),
                    if (job.customer != null) ...[
                      const SizedBox(height: DeliverySpacing.xs),
                      Text(job.customer!.displayPhone),
                    ],
                    const SizedBox(height: DeliverySpacing.sm),
                    Text(job.address.summary),
                    if (job.customer != null) ...[
                      const SizedBox(height: DeliverySpacing.md),
                      AppButton(
                        label: context.t('delivery.call_customer'),
                        icon: Icons.call_outlined,
                        variant: AppButtonVariant.secondary,
                        onPressed: isSubmitting ? null : onCallCustomer,
                      ),
                    ],
                    if (job.canOpenMap) ...[
                      const SizedBox(height: DeliverySpacing.sm),
                      AppButton(
                        label: context.t('delivery.go_to_customer'),
                        icon: Icons.map_outlined,
                        onPressed: isSubmitting ? null : onOpenMap,
                      ),
                    ],
                  ],
                ),
              ),
              if (note != null && note.isNotEmpty) ...[
                const SizedBox(height: DeliverySpacing.lg),
                Text(context.t('common.notes'), style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: DeliverySpacing.sm),
                Text(note),
              ],
              if (actionError != null) ...[
                const SizedBox(height: DeliverySpacing.md),
                Text(
                  context.t(actionError!),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DeliveryColors.error,
                      ),
                ),
              ],
            ],
          ),
        ),
        Container(
          decoration: const BoxDecoration(
            color: DeliveryColors.surfaceContainerLowest,
            border: Border(top: BorderSide(color: DeliveryColors.cardBorder)),
          ),
          child: SafeArea(
            minimum: const EdgeInsets.all(DeliverySpacing.marginMobile),
            child: _ActionButtons(
              job: job,
              isSubmitting: isSubmitting,
              onAcceptOrder: onAcceptOrder,
              onAcceptAssigned: onAcceptAssigned,
              onStart: onStart,
              onComplete: onComplete,
              onCollectPayment: onCollectPayment,
              onCollectCash: onCollectCash,
              onCheckPayment: onCheckPayment,
              onReject: onReject,
            ),
          ),
        ),
      ],
    );
  }

  Widget _deliveryBody(BuildContext context) {
    final dateFormat = DateFormat('dd MMM yyyy, hh:mm a');
    final status = job.assignment?.status ?? job.orderStatus;

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(DeliverySpacing.marginMobile),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      job.orderNumber,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                  ),
                  StatusChip(status: status),
                ],
              ),
              const SizedBox(height: DeliverySpacing.xs),
              Text(
                dateFormat.format(job.placedAt.toLocal()),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DeliveryColors.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: DeliverySpacing.lg),
              _PaymentSummaryCard(
                job: job,
                statusKey: paymentStatusKey,
              ),
              const SizedBox(height: DeliverySpacing.lg),
              Text(context.t('delivery.store'), style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: DeliverySpacing.sm),
              _InfoCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.storefront_outlined, color: DeliveryColors.primary),
                        const SizedBox(width: DeliverySpacing.sm),
                        Expanded(
                          child: Text(
                            job.store.name,
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                        ),
                      ],
                    ),
                    if (job.store.addressSummary.isNotEmpty) ...[
                      const SizedBox(height: DeliverySpacing.sm),
                      Text(job.store.addressSummary),
                    ],
                    if (job.store.canOpenMap || job.store.canCall) ...[
                      const SizedBox(height: DeliverySpacing.md),
                      Row(
                        children: [
                          if (job.store.canOpenMap)
                            Expanded(
                              child: AppButton(
                                label: context.t('delivery.go_to_shop_map'),
                                icon: Icons.map_outlined,
                                variant: AppButtonVariant.secondary,
                                onPressed: isSubmitting ? null : onOpenShopMap,
                              ),
                            ),
                          if (job.store.canOpenMap && job.store.canCall)
                            const SizedBox(width: DeliverySpacing.sm),
                          if (job.store.canCall)
                            Expanded(
                              child: AppButton(
                                label: context.t('delivery.call_shop'),
                                icon: Icons.call_outlined,
                                variant: AppButtonVariant.outline,
                                onPressed: isSubmitting ? null : onCallShop,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              if (job.localShop != null) ...[
                const SizedBox(height: DeliverySpacing.lg),
                Text(context.t('delivery.pickup'), style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: DeliverySpacing.sm),
                _LocalShopPickupCard(
                  shop: job.localShop!,
                  isSubmitting: isSubmitting,
                  onOpenMap: onOpenLocalShopMap,
                  onCall: onCallLocalShop,
                ),
              ],
              if (job.customer != null) ...[
                const SizedBox(height: DeliverySpacing.lg),
                Text(context.t('delivery.customer'), style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: DeliverySpacing.sm),
                _InfoCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        job.customer!.displayPhone,
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      const SizedBox(height: DeliverySpacing.md),
                      AppButton(
                        label: context.t('delivery.call_customer'),
                        icon: Icons.call_outlined,
                        variant: AppButtonVariant.secondary,
                        onPressed: isSubmitting ? null : onCallCustomer,
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: DeliverySpacing.lg),
              Text(
                context.t('delivery.delivery_address'),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: DeliverySpacing.sm),
              _InfoCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.location_on, color: DeliveryColors.primary),
                        const SizedBox(width: DeliverySpacing.sm),
                        Expanded(
                          child: Text(
                            job.address.fullName?.trim().isNotEmpty == true
                                ? '${job.address.label} · ${job.address.fullName}'
                                : job.address.label,
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: DeliverySpacing.sm),
                    Text(job.address.summary),
                    if (job.canOpenMap) ...[
                      const SizedBox(height: DeliverySpacing.md),
                      AppButton(
                        label: context.t('delivery.go_to_map'),
                        icon: Icons.map_outlined,
                        onPressed: isSubmitting ? null : onOpenMap,
                      ),
                    ],
                  ],
                ),
              ),
              if (job.notes != null && job.notes!.trim().isNotEmpty) ...[
                const SizedBox(height: DeliverySpacing.lg),
                Text(context.t('common.notes'), style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: DeliverySpacing.sm),
                Text(job.notes!),
              ],
              const SizedBox(height: DeliverySpacing.lg),
              Text(context.t('common.items'), style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: DeliverySpacing.sm),
              if (job.items.isEmpty)
                Text(
                  context.t('delivery.no_items'),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DeliveryColors.onSurfaceVariant,
                      ),
                )
              else
                _JobItems(items: job.items),
              if (actionError != null) ...[
                const SizedBox(height: DeliverySpacing.md),
                Text(
                  context.t(actionError!),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DeliveryColors.error,
                      ),
                ),
              ],
            ],
          ),
        ),
        Container(
          decoration: const BoxDecoration(
            color: DeliveryColors.surfaceContainerLowest,
            border: Border(top: BorderSide(color: DeliveryColors.cardBorder)),
          ),
          child: SafeArea(
            minimum: const EdgeInsets.all(DeliverySpacing.marginMobile),
            child: _ActionButtons(
              job: job,
              isSubmitting: isSubmitting,
              onAcceptOrder: onAcceptOrder,
              onAcceptAssigned: onAcceptAssigned,
              onStart: onStart,
              onComplete: onComplete,
              onCollectPayment: onCollectPayment,
              onCollectCash: onCollectCash,
              onCheckPayment: onCheckPayment,
              onReject: onReject,
            ),
          ),
        ),
      ],
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(DeliverySpacing.md),
      decoration: BoxDecoration(
        color: DeliveryColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(DeliveryRadius.lg),
        border: Border.all(color: DeliveryColors.cardBorder),
      ),
      child: child,
    );
  }
}

class _LocalShopPickupCard extends StatelessWidget {
  const _LocalShopPickupCard({
    required this.shop,
    required this.isSubmitting,
    this.onOpenMap,
    this.onCall,
  });

  final DeliveryStore shop;
  final bool isSubmitting;
  final VoidCallback? onOpenMap;
  final VoidCallback? onCall;

  @override
  Widget build(BuildContext context) {
    final phone = shop.displayPhone;

    return _InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.storefront_outlined, color: DeliveryColors.primary),
              const SizedBox(width: DeliverySpacing.sm),
              Expanded(
                child: Text(
                  shop.name,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              ),
            ],
          ),
          const SizedBox(height: DeliverySpacing.sm),
          Text(
            context.t('delivery.local_shop_pickup_note'),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DeliveryColors.onSurfaceVariant,
                ),
          ),
          if (phone != null) ...[
            const SizedBox(height: DeliverySpacing.md),
            Text(
              context.t('delivery.shop_phone'),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DeliveryColors.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: DeliverySpacing.xs),
            Text(
              phone,
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ],
          if (shop.addressSummary.isNotEmpty) ...[
            const SizedBox(height: DeliverySpacing.md),
            Text(
              context.t('delivery.address'),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DeliveryColors.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: DeliverySpacing.xs),
            Text(shop.addressSummary),
          ],
          if (shop.canOpenMap || shop.canCall) ...[
            const SizedBox(height: DeliverySpacing.md),
            Row(
              children: [
                if (shop.canOpenMap)
                  Expanded(
                    child: AppButton(
                      label: context.t('delivery.go_to_map'),
                      icon: Icons.map_outlined,
                      variant: AppButtonVariant.secondary,
                      onPressed: isSubmitting ? null : onOpenMap,
                    ),
                  ),
                if (shop.canOpenMap && shop.canCall)
                  const SizedBox(width: DeliverySpacing.sm),
                if (shop.canCall)
                  Expanded(
                    child: AppButton(
                      label: context.t('delivery.call_shop'),
                      icon: Icons.call_outlined,
                      variant: AppButtonVariant.outline,
                      onPressed: isSubmitting ? null : onCall,
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _PaymentSummaryCard extends StatelessWidget {
  const _PaymentSummaryCard({required this.job, this.statusKey});

  final DeliveryJob job;
  final String? statusKey;

  @override
  Widget build(BuildContext context) {
    final amount = formatDeliveryPaise(job.payment?.amountPaise ?? job.grandTotalPaise);
    final isCod = job.payment?.isCod == true;
    final captured = job.payment?.isCaptured == true;
    final title = job.payment == null
        ? context.t('delivery.order_total')
        : isCod
            ? (captured
                ? context.t('delivery.payment_received')
                : context.t('delivery.cod_collect', {'amount': amount}))
            : context.t('delivery.paid_online');

    return _InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.t('delivery.order_id'), style: Theme.of(context).textTheme.labelMedium),
          Text(job.orderNumber, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: DeliverySpacing.sm),
          Text(context.t('delivery.order_total'), style: Theme.of(context).textTheme.labelMedium),
          Text(amount, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: DeliverySpacing.sm),
          Text(title, style: Theme.of(context).textTheme.titleSmall),
          if (isCod && !captured) ...[
            const SizedBox(height: DeliverySpacing.xs),
            Text(
              context.t('delivery.amount_to_collect', {'amount': amount}),
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
          if (statusKey != null) ...[
            const SizedBox(height: DeliverySpacing.sm),
            Text(context.t(statusKey!)),
          ],
        ],
      ),
    );
  }
}

class _ActionButtons extends StatelessWidget {
  const _ActionButtons({
    required this.job,
    required this.isSubmitting,
    required this.onAcceptOrder,
    required this.onAcceptAssigned,
    required this.onStart,
    required this.onComplete,
    required this.onCollectPayment,
    required this.onCollectCash,
    required this.onCheckPayment,
    required this.onReject,
  });

  final DeliveryJob job;
  final bool isSubmitting;
  final VoidCallback onAcceptOrder;
  final VoidCallback onAcceptAssigned;
  final VoidCallback onStart;
  final VoidCallback onComplete;
  final VoidCallback onCollectPayment;
  final VoidCallback onCollectCash;
  final VoidCallback onCheckPayment;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    if (job.assignment?.isCompleted == true || job.assignment?.isRejected == true) {
      return AppButton(
        label: context.t('delivery.back_jobs'),
        variant: AppButtonVariant.outline,
        onPressed: isSubmitting ? null : () => context.go('/partner/history'),
      );
    }

    if (job.canClaim) {
      return AppButton(
        label: context.t(job.isReturnPickup ? 'delivery.accept_pickup' : 'delivery.accept'),
        isLoading: isSubmitting,
        onPressed: isSubmitting ? null : onAcceptOrder,
      );
    }

    if (job.canAccept) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppButton(
            label: context.t(job.isReturnPickup ? 'delivery.accept_pickup' : 'delivery.accept'),
            isLoading: isSubmitting,
            onPressed: isSubmitting ? null : onAcceptAssigned,
          ),
          const SizedBox(height: DeliverySpacing.sm),
          AppButton(
            label: context.t('delivery.reject'),
            variant: AppButtonVariant.outline,
            isLoading: isSubmitting,
            onPressed: isSubmitting ? null : onReject,
          ),
        ],
      );
    }

    if (job.assignment?.isAccepted == true && job.needsCodCollection) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppButton(
            label: context.t('delivery.on_the_way'),
            icon: Icons.local_shipping_outlined,
            isLoading: isSubmitting,
            onPressed: isSubmitting ? null : onStart,
          ),
          const SizedBox(height: DeliverySpacing.sm),
          _CodCollectActions(
            isSubmitting: isSubmitting,
            onCollectPayment: onCollectPayment,
            onCollectCash: onCollectCash,
          ),
          const SizedBox(height: DeliverySpacing.sm),
          AppButton(
            label: context.t('delivery.reject'),
            variant: AppButtonVariant.outline,
            isLoading: isSubmitting,
            onPressed: isSubmitting ? null : onReject,
          ),
        ],
      );
    }

    if (job.assignment?.isInProgress == true && job.needsCodCollection) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _CodCollectActions(
            isSubmitting: isSubmitting,
            onCollectPayment: onCollectPayment,
            onCollectCash: onCollectCash,
            primaryQr: true,
          ),
          const SizedBox(height: DeliverySpacing.sm),
          AppButton(
            label: context.t('delivery.check_payment'),
            variant: AppButtonVariant.outline,
            isLoading: isSubmitting,
            onPressed: isSubmitting ? null : onCheckPayment,
          ),
        ],
      );
    }

    if (job.canStartDelivery && job.assignment!.isAccepted) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppButton(
            label: context.t(job.isReturnPickup ? 'delivery.on_the_way_pickup' : 'delivery.on_the_way'),
            icon: Icons.local_shipping_outlined,
            isLoading: isSubmitting,
            onPressed: isSubmitting ? null : onStart,
          ),
          const SizedBox(height: DeliverySpacing.sm),
          AppButton(
            label: context.t('delivery.reject'),
            variant: AppButtonVariant.outline,
            isLoading: isSubmitting,
            onPressed: isSubmitting ? null : onReject,
          ),
        ],
      );
    }

    if (job.canComplete) {
      return AppButton(
        label: context.t(job.isReturnPickup ? 'delivery.continue_pickup_code' : 'delivery.continue_otp'),
        isLoading: isSubmitting,
        onPressed: isSubmitting ? null : onComplete,
      );
    }

    return AppButton(
      label: context.t('delivery.back_active'),
      variant: AppButtonVariant.outline,
      onPressed: isSubmitting ? null : () => context.go('/partner/jobs?tab=active'),
    );
  }
}

class _CodCollectActions extends StatelessWidget {
  const _CodCollectActions({
    required this.isSubmitting,
    required this.onCollectPayment,
    required this.onCollectCash,
    this.primaryQr = false,
  });

  final bool isSubmitting;
  final VoidCallback onCollectPayment;
  final VoidCallback onCollectCash;
  final bool primaryQr;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: AppButton(
            label: context.t('delivery.show_qr'),
            icon: Icons.qr_code_2,
            variant: primaryQr ? AppButtonVariant.primary : AppButtonVariant.secondary,
            isLoading: isSubmitting,
            onPressed: isSubmitting ? null : onCollectPayment,
          ),
        ),
        const SizedBox(width: DeliverySpacing.sm),
        Expanded(
          child: AppButton(
            label: context.t('delivery.cash_collected'),
            icon: Icons.payments_outlined,
            variant: primaryQr ? AppButtonVariant.secondary : AppButtonVariant.secondary,
            isLoading: isSubmitting,
            onPressed: isSubmitting ? null : onCollectCash,
          ),
        ),
      ],
    );
  }
}

class _JobItems extends StatelessWidget {
  const _JobItems({required this.items});

  final List<DeliveryJobItem> items;

  @override
  Widget build(BuildContext context) {
    final local = items.where((item) => item.isLocalShop).toList();
    final regular = items.where((item) => !item.isLocalShop).toList();
    if (local.isEmpty || regular.isEmpty) {
      return _InfoCard(child: _itemList(context, items));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(context.t('cart.local_shop_group'), style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: DeliverySpacing.sm),
        _InfoCard(child: _itemList(context, local)),
        const SizedBox(height: DeliverySpacing.md),
        Text(context.t('cart.regular_group'), style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: DeliverySpacing.sm),
        _InfoCard(child: _itemList(context, regular)),
      ],
    );
  }

  Widget _itemList(BuildContext context, List<DeliveryJobItem> group) {
    return Column(
      children: [
        for (var i = 0; i < group.length; i++) ...[
          if (i > 0) const SizedBox(height: DeliverySpacing.md),
          _tile(context, group[i]),
        ],
      ],
    );
  }

  Widget _tile(BuildContext context, DeliveryJobItem item) {
    final imageUrl = item.imageUrl?.trim();
    final hasImage = imageUrl != null && imageUrl.isNotEmpty;
    final qtyLabel =
        item.variantLabel.isEmpty ? '× ${item.quantity}' : '${item.variantLabel} × ${item.quantity}';
    final theme = Theme.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(DeliveryRadius.sm),
          child: SizedBox(
            width: 64,
            height: 64,
            child: hasImage
                ? CachedNetworkImage(
                    imageUrl: imageUrl,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => ColoredBox(
                      color: DeliveryColors.surfaceContainer,
                      child: const Center(
                        child: SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      ),
                    ),
                    errorWidget: (_, __, ___) => const ColoredBox(
                      color: DeliveryColors.surfaceContainer,
                      child: Icon(Icons.image_not_supported_outlined),
                    ),
                  )
                : const ColoredBox(
                    color: DeliveryColors.surfaceContainer,
                    child: Icon(Icons.image_not_supported_outlined),
                  ),
          ),
        ),
        const SizedBox(width: DeliverySpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.productName,
                style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: DeliverySpacing.xs),
              Text(
                qtyLabel,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: DeliveryColors.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
