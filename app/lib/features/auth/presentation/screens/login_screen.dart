import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_phone_field.dart';
import '../auth_view_model.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phoneController = TextEditingController();

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthUiState>(authViewModelProvider, (previous, next) {
      if (next is AuthOtpSent) {
        context.push('/otp', extra: next.phone);
      }
      if (next is AuthError) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(next.message)),
        );
      }
    });

    final state = ref.watch(authViewModelProvider);
    final isLoading = state is AuthLoading;

    return Scaffold(
      backgroundColor: CustomerColors.surfaceContainerLowest,
      body: SafeArea(
        child: Stack(
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
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: CustomerSpacing.marginMobile,
                vertical: CustomerSpacing.xl,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.location_on, color: CustomerColors.primary, size: 36),
                      const SizedBox(width: CustomerSpacing.sm),
                      Text(
                        'Dailyfax',
                        style: Theme.of(context).textTheme.displayLarge?.copyWith(
                              color: CustomerColors.primary,
                            ),
                      ),
                    ],
                  ),
                  const SizedBox(height: CustomerSpacing.xl),
                  Text(
                    'Get your essentials delivered fast',
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: CustomerSpacing.sm),
                  Text(
                    'Enter your mobile number to get started.',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: CustomerColors.onSurfaceVariant,
                        ),
                  ),
                  const SizedBox(height: CustomerSpacing.xl),
                  AppPhoneField(controller: _phoneController),
                  const Spacer(),
                  AppButton(
                    label: 'Continue',
                    isLoading: isLoading,
                    onPressed: isLoading
                        ? null
                        : () => ref
                            .read(authViewModelProvider.notifier)
                            .requestOtp(_phoneController.text),
                  ),
                  const SizedBox(height: CustomerSpacing.md),
                  Text.rich(
                    TextSpan(
                      text: 'By continuing, you agree to our ',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: CustomerColors.onSurfaceVariant,
                          ),
                      children: [
                        TextSpan(
                          text: 'Terms of Service',
                          style: TextStyle(color: CustomerColors.primary, fontWeight: FontWeight.w600),
                        ),
                        const TextSpan(text: ' and '),
                        TextSpan(
                          text: 'Privacy Policy',
                          style: TextStyle(color: CustomerColors.primary, fontWeight: FontWeight.w600),
                        ),
                        const TextSpan(text: '.'),
                      ],
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
