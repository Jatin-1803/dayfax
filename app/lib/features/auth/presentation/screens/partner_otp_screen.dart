import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_button.dart';
import '../auth_view_model.dart';

class PartnerOtpScreen extends ConsumerStatefulWidget {
  const PartnerOtpScreen({super.key, required this.phone});

  final String phone;

  @override
  ConsumerState<PartnerOtpScreen> createState() => _PartnerOtpScreenState();
}

class _PartnerOtpScreenState extends ConsumerState<PartnerOtpScreen> {
  final _controllers = List.generate(4, (_) => TextEditingController());
  final _focusNodes = List.generate(4, (_) => FocusNode());
  Timer? _resendTimer;
  int _resendSeconds = 30;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(partnerAuthSurfaceProvider.notifier).state = true;
      if (_focusNodes.isNotEmpty) _focusNodes.first.requestFocus();
    });
    _startResendCountdown();
  }

  @override
  void dispose() {
    _resendTimer?.cancel();
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  String get _otp => _controllers.map((c) => c.text).join();

  String get _maskedPhone {
    final digits = widget.phone.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 10) return '+91 $digits';
    return '+91 ${digits.substring(0, 2)}******${digits.substring(8)}';
  }

  void _startResendCountdown() {
    _resendTimer?.cancel();
    setState(() => _resendSeconds = 30);
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_resendSeconds <= 1) {
        timer.cancel();
        if (mounted) setState(() => _resendSeconds = 0);
        return;
      }
      if (mounted) setState(() => _resendSeconds -= 1);
    });
  }

  Future<void> _verify() {
    return ref.read(authViewModelProvider.notifier).verifyOtp(
          phone: widget.phone,
          otp: _otp,
          requireDeliveryPartner: true,
        );
  }

  Future<void> _maybeAutoSubmit() async {
    if (_otp.length != 4 || _submitting) return;
    _submitting = true;
    await _verify();
    _submitting = false;
  }

  void _onDigitChanged(int index, String value) {
    if (value.length > 1) {
      final digits = value.replaceAll(RegExp(r'\D'), '');
      for (var i = 0; i < 4; i++) {
        _controllers[i].text = i < digits.length ? digits[i] : '';
      }
      final focusIndex = digits.length.clamp(0, 3);
      _focusNodes[focusIndex].requestFocus();
      _maybeAutoSubmit();
      return;
    }

    if (value.isNotEmpty && index < 3) {
      _focusNodes[index + 1].requestFocus();
    }
    if (value.isEmpty && index > 0) {
      _focusNodes[index - 1].requestFocus();
    }
    if (_otp.length == 4) {
      _maybeAutoSubmit();
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthUiState>(authViewModelProvider, (previous, next) {
      if (next is AuthAuthenticated) {
        ref.read(partnerAuthSurfaceProvider.notifier).state = false;
        context.go('/partner/home');
      }
      if (next is AuthError) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ref.tr(next.message))),
        );
      }
      if (next is AuthOtpSent) {
        _startResendCountdown();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ref.tr('auth.otp_resent'))),
        );
      }
    });

    final state = ref.watch(authViewModelProvider);
    final isLoading = state is AuthLoading;

    return Scaffold(
      backgroundColor: DeliveryColors.background,
      appBar: AppBar(
        backgroundColor: DeliveryColors.background,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/partner/login'),
        ),
      ),
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
            horizontal: DeliverySpacing.lg,
            vertical: DeliverySpacing.lg,
          ),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: constraints.maxHeight - DeliverySpacing.lg * 2,
            ),
            child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
              Text(
                ref.t('auth.verify_otp'),
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                      color: DeliveryColors.deepSlate,
                    ),
              ),
              const SizedBox(height: DeliverySpacing.sm),
              Text(
                ref.t('auth.otp_sent_to', {'phone': _maskedPhone}),
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: DeliveryColors.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: DeliverySpacing.sm),
              TextButton(
                onPressed: () => context.go('/partner/login'),
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  ref.t('delivery.auth.change_number'),
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: DeliveryColors.primary,
                      ),
                ),
              ),
              const SizedBox(height: DeliverySpacing.xl),
              Row(
                children: List.generate(4, (index) {
                  return Expanded(
                    child: Padding(
                    padding: EdgeInsets.only(left: index == 0 ? 0 : DeliverySpacing.sm),
                    child: SizedBox(
                    height: 56,
                    child: TextField(
                      controller: _controllers[index],
                      focusNode: _focusNodes[index],
                      textAlign: TextAlign.center,
                      keyboardType: TextInputType.number,
                      textInputAction:
                          index == 3 ? TextInputAction.done : TextInputAction.next,
                      style: Theme.of(context).textTheme.headlineLarge,
                      autofillHints: index == 0 ? const [AutofillHints.oneTimeCode] : null,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(4),
                      ],
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: DeliveryColors.inputFill,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(DeliveryRadius.md),
                          borderSide: const BorderSide(color: DeliveryColors.cardBorder),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(DeliveryRadius.md),
                          borderSide: const BorderSide(color: DeliveryColors.cardBorder),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(DeliveryRadius.md),
                          borderSide: const BorderSide(
                            color: DeliveryColors.primary,
                            width: 1.5,
                          ),
                        ),
                      ),
                      onChanged: (value) => _onDigitChanged(index, value),
                    ),
                    ),
                  ),
                  );
                }),
              ),
              const SizedBox(height: DeliverySpacing.lg),
              TextButton(
                onPressed: isLoading || _resendSeconds > 0
                    ? null
                    : () {
                        ref.read(authViewModelProvider.notifier).requestOtp(widget.phone);
                      },
                child: Text(
                  _resendSeconds > 0
                      ? ref.t('auth.resend_in', {'seconds': '$_resendSeconds'})
                      : ref.t('auth.resend_code'),
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: _resendSeconds > 0
                            ? DeliveryColors.onSurfaceVariant
                            : DeliveryColors.primary,
                      ),
                ),
              ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.only(top: DeliverySpacing.xl),
                child: AppButton(
                  label: ref.t('delivery.auth.verify'),
                  isLoading: isLoading,
                  onPressed: isLoading ? null : _verify,
                ),
              ),
            ],
            ),
          ),
            );
          },
        ),
      ),
    );
  }
}
