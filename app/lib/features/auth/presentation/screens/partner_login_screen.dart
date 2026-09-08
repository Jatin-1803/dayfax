import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_phone_field.dart';
import '../../../../shared/widgets/dayfax_logo.dart';
import '../auth_view_model.dart';

class PartnerLoginScreen extends ConsumerStatefulWidget {
  const PartnerLoginScreen({super.key});

  @override
  ConsumerState<PartnerLoginScreen> createState() => _PartnerLoginScreenState();
}

class _PartnerLoginScreenState extends ConsumerState<PartnerLoginScreen> {
  final _phoneController = TextEditingController();
  String? _phoneError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(partnerAuthSurfaceProvider.notifier).state = true;
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
        context.push('/partner/otp', extra: next.phone);
      }
      if (next is AuthError) {
        setState(() => _phoneError = ref.tr(next.message));
      }
    });

    final state = ref.watch(authViewModelProvider);
    final isLoading = state is AuthLoading;

    return Scaffold(
      backgroundColor: DeliveryColors.background,
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
            horizontal: DeliverySpacing.lg,
            vertical: DeliverySpacing.xl,
          ),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: constraints.maxHeight - DeliverySpacing.xl * 2,
            ),
            child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                children: [
              const SizedBox(height: DeliverySpacing.md),
              DayfaxLogo(
                height: 64,
                semanticLabel: ref.t('app.name'),
              ),
              const SizedBox(height: DeliverySpacing.md),
              Text(
                ref.t('delivery.auth.title'),
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                      color: DeliveryColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: DeliverySpacing.sm),
              Text(
                ref.t('delivery.auth.subtitle'),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DeliveryColors.onSurfaceVariant,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: DeliverySpacing.xl),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  ref.t('delivery.auth.phone_label'),
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: DeliveryColors.onSurface,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
              const SizedBox(height: DeliverySpacing.xs),
              AppPhoneField(
                controller: _phoneController,
                errorText: _phoneError,
                hintText: ref.t('auth.phone_hint'),
                onChanged: (_) {
                  if (_phoneError != null) {
                    setState(() => _phoneError = null);
                  }
                },
              ),
              const SizedBox(height: DeliverySpacing.md),
              AppButton(
                label: ref.t('auth.continue'),
                isLoading: isLoading,
                onPressed: isLoading ? null : _submit,
              ),
                ],
              ),
              Column(
                children: [
              const SizedBox(height: DeliverySpacing.xl),
              TextButton(
                onPressed: () {
                  ref.read(partnerAuthSurfaceProvider.notifier).state = false;
                  context.go('/login');
                },
                child: Text(
                  ref.t('delivery.auth.customer_entry'),
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: DeliveryColors.primary,
                      ),
                ),
              ),
              const SizedBox(height: DeliverySpacing.md),
              Text(
                ref.t('auth.terms'),
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: DeliveryColors.onSurfaceVariant,
                      fontWeight: FontWeight.w400,
                    ),
                textAlign: TextAlign.center,
              ),
                ],
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
