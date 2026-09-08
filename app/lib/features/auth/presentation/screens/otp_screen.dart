import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/routing/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_button.dart';
import '../auth_view_model.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.phone});

  final String phone;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _controllers = List.generate(4, (_) => TextEditingController());
  final _focusNodes = List.generate(4, (_) => FocusNode());
  Timer? _resendTimer;
  int _resendSeconds = 30;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _startResendCountdown();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_focusNodes.isNotEmpty) _focusNodes.first.requestFocus();
    });
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

  Future<void> _maybeAutoSubmit() async {
    if (_otp.length != 4 || _submitting) return;
    _submitting = true;
    await ref.read(authViewModelProvider.notifier).verifyOtp(
          phone: widget.phone,
          otp: _otp,
        );
    _submitting = false;
  }

  void _onDigitChanged(int index, String value) {
    if (value.length > 1) {
      // Paste support: distribute digits across boxes.
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
        final role = ref.read(appRoleProvider);
        context.go(homePathForRole(role));
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
      backgroundColor: CustomerColors.surfaceContainerLowest,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
            horizontal: CustomerSpacing.marginMobile,
            vertical: CustomerSpacing.lg,
          ),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: constraints.maxHeight - CustomerSpacing.lg * 2,
            ),
            child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
              Text(ref.t('auth.verify_otp'), style: Theme.of(context).textTheme.headlineLarge),
              const SizedBox(height: CustomerSpacing.sm),
              Text(
                ref.t('auth.otp_sent_to', {'phone': _maskedPhone}),
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: CustomerColors.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: CustomerSpacing.xl),
              Row(
                children: List.generate(4, (index) {
                  return Expanded(
                    child: Padding(
                    padding: EdgeInsets.only(left: index == 0 ? 0 : CustomerSpacing.sm),
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
                        fillColor: CustomerColors.inputFill,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(CustomerRadius.md),
                          borderSide: BorderSide.none,
                        ),
                      ),
                      onChanged: (value) => _onDigitChanged(index, value),
                    ),
                    ),
                  ),
                  );
                }),
              ),
              const SizedBox(height: CustomerSpacing.lg),
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
                            ? CustomerColors.onSurfaceVariant
                            : CustomerColors.primary,
                      ),
                ),
              ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.only(top: CustomerSpacing.xl),
                child: AppButton(
                  label: ref.t('auth.verify_continue'),
                  isLoading: isLoading,
                  onPressed: isLoading
                      ? null
                      : () => ref.read(authViewModelProvider.notifier).verifyOtp(
                            phone: widget.phone,
                            otp: _otp,
                          ),
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
