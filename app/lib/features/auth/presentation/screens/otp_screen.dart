import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthUiState>(authViewModelProvider, (previous, next) {
      if (next is AuthAuthenticated) {
        final role = ref.read(appRoleProvider);
        context.go(homePathForRole(role));
      }
      if (next is AuthError) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(next.message)),
        );
      }
    });

    final state = ref.watch(authViewModelProvider);
    final isLoading = state is AuthLoading;
    final masked = '+91 ${widget.phone.substring(0, 2)}******${widget.phone.substring(8)}';

    return Scaffold(
      backgroundColor: CustomerColors.surfaceContainerLowest,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: CustomerSpacing.marginMobile,
            vertical: CustomerSpacing.lg,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Verify OTP', style: Theme.of(context).textTheme.headlineLarge),
              const SizedBox(height: CustomerSpacing.sm),
              Text(
                'Enter the 4-digit code sent to $masked',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: CustomerColors.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: CustomerSpacing.xl),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(4, (index) {
                  return SizedBox(
                    width: 56,
                    height: 56,
                    child: TextField(
                      controller: _controllers[index],
                      focusNode: _focusNodes[index],
                      textAlign: TextAlign.center,
                      keyboardType: TextInputType.number,
                      style: Theme.of(context).textTheme.headlineLarge,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(1),
                      ],
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: CustomerColors.inputFill,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(CustomerRadius.md),
                          borderSide: BorderSide.none,
                        ),
                      ),
                      onChanged: (value) {
                        if (value.isNotEmpty && index < 3) {
                          _focusNodes[index + 1].requestFocus();
                        }
                        if (value.isEmpty && index > 0) {
                          _focusNodes[index - 1].requestFocus();
                        }
                      },
                    ),
                  );
                }),
              ),
              const SizedBox(height: CustomerSpacing.lg),
              TextButton(
                onPressed: isLoading
                    ? null
                    : () => ref.read(authViewModelProvider.notifier).requestOtp(widget.phone),
                child: Text(
                  'Resend code',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: CustomerColors.primary,
                      ),
                ),
              ),
              const Spacer(),
              AppButton(
                label: 'Verify & Continue',
                isLoading: isLoading,
                onPressed: isLoading
                    ? null
                    : () => ref.read(authViewModelProvider.notifier).verifyOtp(
                          phone: widget.phone,
                          otp: _otp,
                        ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
