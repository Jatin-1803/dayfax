import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/app_controls/app_gate.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_button.dart';
import '../auth_view_model.dart';

class LoginMethodScreen extends ConsumerStatefulWidget {
  const LoginMethodScreen({super.key, required this.phone});

  final String phone;

  @override
  ConsumerState<LoginMethodScreen> createState() => _LoginMethodScreenState();
}

class _LoginMethodScreenState extends ConsumerState<LoginMethodScreen> {
  String? _error;
  var _redirecting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _redirectIfOtpDisabled());
  }

  Future<void> _redirectIfOtpDisabled() async {
    final bootstrap = await ref.read(appBootstrapProvider.future);
    if (!mounted || bootstrap.loginOtpEnabled) return;
    setState(() => _redirecting = true);
    context.replace('/login/password', extra: widget.phone);
  }

  String get _maskedPhone {
    final digits = widget.phone.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 10) return '+91 $digits';
    return '+91 ${digits.substring(0, 2)}******${digits.substring(8)}';
  }

  Future<void> _continueWithOtp() async {
    setState(() => _error = null);
    await ref.read(authViewModelProvider.notifier).requestOtp(widget.phone);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthUiState>(authViewModelProvider, (previous, next) {
      if (next is AuthOtpSent) {
        context.push('/otp', extra: next.phone);
      }
      if (next is AuthError) {
        setState(() => _error = ref.tr(next.message));
      }
    });

    final state = ref.watch(authViewModelProvider);
    final isLoading = state is AuthLoading;

    if (_redirecting) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: CustomerColors.surfaceContainerLowest,
      appBar: AppBar(
        title: Text(ref.t('auth.choose_method_title')),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                ref.t('auth.choose_method_subtitle', {'phone': _maskedPhone}),
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: CustomerColors.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: CustomerSpacing.xl),
              AppButton(
                label: ref.t('auth.continue_with_otp'),
                isLoading: isLoading,
                onPressed: isLoading ? null : _continueWithOtp,
              ),
              const SizedBox(height: CustomerSpacing.md),
              AppButton(
                label: ref.t('auth.continue_with_password'),
                variant: AppButtonVariant.outline,
                onPressed: isLoading
                    ? null
                    : () => context.push('/login/password', extra: widget.phone),
              ),
              if (_error != null) ...[
                const SizedBox(height: CustomerSpacing.md),
                Text(
                  _error!,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.error,
                      ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
