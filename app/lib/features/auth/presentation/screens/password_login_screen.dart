import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/app_controls/app_gate.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/routing/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_button.dart';
import '../auth_view_model.dart';

class PasswordLoginScreen extends ConsumerStatefulWidget {
  const PasswordLoginScreen({super.key, required this.phone});

  final String phone;

  @override
  ConsumerState<PasswordLoginScreen> createState() => _PasswordLoginScreenState();
}

class _PasswordLoginScreenState extends ConsumerState<PasswordLoginScreen> {
  final _passwordController = TextEditingController();
  String? _error;
  var _obscure = true;

  @override
  void dispose() {
    _passwordController.dispose();
    super.dispose();
  }

  String get _maskedPhone {
    final digits = widget.phone.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 10) return '+91 $digits';
    return '+91 ${digits.substring(0, 2)}******${digits.substring(8)}';
  }

  void _submit() {
    setState(() => _error = null);
    ref.read(authViewModelProvider.notifier).loginWithPassword(
          phone: widget.phone,
          password: _passwordController.text,
        );
  }

  Future<void> _startOtpForNewUser() async {
    setState(() => _error = null);
    await ref.read(authViewModelProvider.notifier).requestOtp(widget.phone);
  }

  @override
  Widget build(BuildContext context) {
    final otpEnabled = ref.watch(loginOtpEnabledProvider);

    ref.listen<AuthUiState>(authViewModelProvider, (previous, next) {
      if (next is AuthAuthenticated) {
        navigateAfterCustomerAuth(context, ref);
      }
      if (next is AuthOtpSent) {
        context.push('/otp', extra: widget.phone);
      }
      if (next is AuthError) {
        setState(() => _error = ref.tr(next.message));
        if (next.message == 'auth.password_not_set') {
          if (otpEnabled) {
            _startOtpForNewUser();
          } else {
            context.push('/login/create-password', extra: widget.phone);
          }
        }
      }
    });

    final state = ref.watch(authViewModelProvider);
    final isLoading = state is AuthLoading;

    return Scaffold(
      backgroundColor: CustomerColors.surfaceContainerLowest,
      appBar: AppBar(
        title: Text(ref.t('auth.password_login_title')),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                ref.t('auth.password_login_subtitle', {'phone': _maskedPhone}),
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: CustomerColors.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: CustomerSpacing.xl),
              TextField(
                controller: _passwordController,
                obscureText: _obscure,
                autofocus: true,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => isLoading ? null : _submit(),
                decoration: InputDecoration(
                  labelText: ref.t('auth.password_label'),
                  errorText: _error,
                  suffixIcon: IconButton(
                    onPressed: () => setState(() => _obscure = !_obscure),
                    icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                  ),
                ),
                onChanged: (_) {
                  if (_error != null) setState(() => _error = null);
                },
              ),
              const SizedBox(height: CustomerSpacing.xl),
              AppButton(
                label: ref.t('auth.sign_in'),
                isLoading: isLoading,
                onPressed: isLoading ? null : _submit,
              ),
              if (otpEnabled) ...[
                const SizedBox(height: CustomerSpacing.md),
                TextButton(
                  onPressed: isLoading ? null : _startOtpForNewUser,
                  child: Text(ref.t('auth.new_user_use_otp')),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
