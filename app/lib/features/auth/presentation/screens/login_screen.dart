import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_phone_field.dart';
import '../../../../shared/widgets/dayfax_logo.dart';
import '../auth_view_model.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phoneController = TextEditingController();
  String? _phoneError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(partnerAuthSurfaceProvider.notifier).state = false;
    });
  }

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  void _submit() {
    final normalized = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(normalized)) {
      setState(() => _phoneError = ref.tr('auth.invalid_phone'));
      return;
    }
    setState(() => _phoneError = null);
    ref.read(authViewModelProvider.notifier).requestOtp(normalized);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthUiState>(authViewModelProvider, (previous, next) {
      if (next is AuthOtpSent) {
        context.push('/otp', extra: next.phone);
      }
      if (next is AuthError) {
        setState(() => _phoneError = ref.tr(next.message));
      }
    });

    final state = ref.watch(authViewModelProvider);
    final isLoading = state is AuthLoading;

    return Scaffold(
      backgroundColor: CustomerColors.surfaceContainerLowest,
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return Stack(
          children: [
            Positioned(
              top: -100,
              left: -100,
              child: Container(
                width: 280,
                height: 280,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: CustomerColors.primaryContainer.withValues(alpha: 0.05),
                ),
              ),
            ),
            SingleChildScrollView(
              padding: const EdgeInsets.symmetric(
                horizontal: CustomerSpacing.marginMobile,
                vertical: CustomerSpacing.xl,
              ),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight - CustomerSpacing.xl * 2),
                child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  DayfaxLogo(
                    height: 64,
                    semanticLabel: ref.t('app.name'),
                  ),
                  const SizedBox(height: CustomerSpacing.xl),
                  Text(
                    ref.t('auth.tagline'),
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: CustomerSpacing.sm),
                  Text(
                    ref.t('auth.enter_mobile'),
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: CustomerColors.onSurfaceVariant,
                        ),
                  ),
                  const SizedBox(height: CustomerSpacing.xl),
                  AppPhoneField(
                    controller: _phoneController,
                    errorText: _phoneError,
                    onChanged: (_) {
                      if (_phoneError != null) {
                        setState(() => _phoneError = null);
                      }
                    },
                  ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                  const SizedBox(height: CustomerSpacing.xl),
                  AppButton(
                    label: ref.t('auth.continue'),
                    isLoading: isLoading,
                    onPressed: isLoading ? null : _submit,
                  ),
                  const SizedBox(height: CustomerSpacing.md),
                  Text(
                    ref.t('auth.terms'),
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: CustomerColors.onSurfaceVariant,
                        ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: CustomerSpacing.md),
                  Center(
                    child: TextButton(
                      onPressed: () => context.push('/partner/login'),
                      child: Text(
                        ref.t('delivery.auth.partner_entry'),
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                              color: CustomerColors.primary,
                            ),
                      ),
                    ),
                  ),
                    ],
                  ),
                ],
              ),
              ),
            ),
          ],
            );
          },
        ),
      ),
    );
  }
}
