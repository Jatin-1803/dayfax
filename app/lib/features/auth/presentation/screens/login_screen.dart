import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/app_controls/app_gate.dart';
import '../../../../core/errors/app_failure.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/routing/app_router.dart';
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
  var _submitting = false;
  var _googleSubmitting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(partnerAuthSurfaceProvider.notifier).state = false;
      ref.read(authViewModelProvider.notifier).reset();
    });
  }

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;

    final normalized = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(normalized)) {
      setState(() => _phoneError = ref.tr('auth.invalid_phone'));
      return;
    }
    setState(() {
      _phoneError = null;
      _submitting = true;
    });

    try {
      final bootstrap = await ref.read(appBootstrapProvider.future);
      if (!mounted) return;

      if (bootstrap.loginOtpEnabled) {
        context.push('/login/method', extra: normalized);
        return;
      }

      final hasPassword =
          await ref.read(authViewModelProvider.notifier).checkHasPassword(normalized);
      if (!mounted) return;

      if (hasPassword) {
        context.push('/login/password', extra: normalized);
      } else {
        context.push('/login/create-password', extra: normalized);
      }
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() => _phoneError = ref.tr(failure.message));
    } catch (_) {
      if (!mounted) return;
      setState(() => _phoneError = ref.tr('error.generic'));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _continueWithGoogle() async {
    if (_googleSubmitting) return;
    setState(() {
      _phoneError = null;
      _googleSubmitting = true;
    });
    try {
      await ref.read(authViewModelProvider.notifier).loginWithGoogle();
    } finally {
      if (mounted) setState(() => _googleSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthUiState>(authViewModelProvider, (previous, next) {
      if (next is AuthAuthenticated) {
        navigateAfterCustomerAuth(context, ref);
      }
      if (next is AuthError) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ref.tr(next.message))),
        );
        ref.read(authViewModelProvider.notifier).resetError();
      }
    });

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
                    constraints: BoxConstraints(
                      minHeight: constraints.maxHeight - CustomerSpacing.xl * 2,
                    ),
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
                              isLoading: _submitting,
                              onPressed: (_submitting || _googleSubmitting) ? null : _submit,
                            ),
                            const SizedBox(height: CustomerSpacing.md),
                            Row(
                              children: [
                                const Expanded(child: Divider()),
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: CustomerSpacing.sm,
                                  ),
                                  child: Text(
                                    ref.t('auth.or'),
                                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                          color: CustomerColors.onSurfaceVariant,
                                        ),
                                  ),
                                ),
                                const Expanded(child: Divider()),
                              ],
                            ),
                            const SizedBox(height: CustomerSpacing.md),
                            AppButton(
                              label: ref.t('auth.continue_with_google'),
                              variant: AppButtonVariant.outline,
                              icon: Icons.g_mobiledata_rounded,
                              isLoading: _googleSubmitting,
                              onPressed: (_submitting || _googleSubmitting)
                                  ? null
                                  : _continueWithGoogle,
                            ),
                            const SizedBox(height: CustomerSpacing.md),
                            Wrap(
                              alignment: WrapAlignment.center,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                Text(
                                  ref.t('auth.terms_prefix'),
                                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                        color: CustomerColors.onSurfaceVariant,
                                      ),
                                ),
                                TextButton(
                                  onPressed: () => context.push('/about/terms'),
                                  style: TextButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(horizontal: 4),
                                    minimumSize: Size.zero,
                                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  ),
                                  child: Text(ref.t('auth.terms_link')),
                                ),
                                Text(
                                  ref.t('auth.terms_and'),
                                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                        color: CustomerColors.onSurfaceVariant,
                                      ),
                                ),
                                TextButton(
                                  onPressed: () => context.push('/about/privacy'),
                                  style: TextButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(horizontal: 4),
                                    minimumSize: Size.zero,
                                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  ),
                                  child: Text(ref.t('auth.privacy_link')),
                                ),
                                Text(
                                  ref.t('auth.terms_suffix'),
                                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                        color: CustomerColors.onSurfaceVariant,
                                      ),
                                ),
                              ],
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
