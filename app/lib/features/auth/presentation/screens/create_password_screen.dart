import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/routing/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_button.dart';
import '../auth_view_model.dart';

/// OTP-off new user: phone + create password → auto login.
/// OTP-on new user after OTP: tokens already stored; set password then enter app.
class CreatePasswordScreen extends ConsumerStatefulWidget {
  const CreatePasswordScreen({super.key, this.phone});

  final String? phone;

  @override
  ConsumerState<CreatePasswordScreen> createState() => _CreatePasswordScreenState();
}

class _CreatePasswordScreenState extends ConsumerState<CreatePasswordScreen> {
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  String? _error;
  var _obscure = true;

  bool get _isRegisterPath => (widget.phone ?? '').isNotEmpty;

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    final password = _passwordController.text;
    final confirm = _confirmController.text;

    if (_isRegisterPath) {
      await ref.read(authViewModelProvider.notifier).registerWithPassword(
            phone: widget.phone!,
            password: password,
            confirmPassword: confirm,
          );
      return;
    }

    final ok = await ref.read(authViewModelProvider.notifier).setInitialPassword(
          password: password,
          confirmPassword: confirm,
        );
    if (!mounted) return;
    if (ok) {
      context.go(homePathForRole(ref.read(appRoleProvider)));
      return;
    }
    final next = ref.read(authViewModelProvider);
    if (next is AuthError) {
      setState(() => _error = ref.tr(next.message));
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = ref.watch(pendingPasswordSetupProvider);

    if (!_isRegisterPath && !pending) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!context.mounted) return;
        if (ref.read(isAuthenticatedProvider) == true) {
          context.go(homePathForRole(ref.read(appRoleProvider)));
        } else {
          context.go('/login');
        }
      });
    }

    ref.listen<AuthUiState>(authViewModelProvider, (previous, next) {
      if (next is AuthAuthenticated) {
        context.go(homePathForRole(ref.read(appRoleProvider)));
      }
      if (next is AuthError) {
        setState(() => _error = ref.tr(next.message));
      }
    });

    final state = ref.watch(authViewModelProvider);
    final isLoading = state is AuthLoading;

    return PopScope(
      canPop: _isRegisterPath,
      child: Scaffold(
        backgroundColor: CustomerColors.surfaceContainerLowest,
        appBar: AppBar(
          automaticallyImplyLeading: _isRegisterPath,
          title: Text(
            ref.t(
              _isRegisterPath ? 'auth.create_account_title' : 'auth.create_password_title',
            ),
          ),
        ),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  ref.t(
                    _isRegisterPath
                        ? 'auth.create_account_subtitle'
                        : 'auth.create_password_subtitle',
                  ),
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: CustomerColors.onSurfaceVariant,
                      ),
                ),
                const SizedBox(height: CustomerSpacing.xl),
                TextField(
                  controller: _passwordController,
                  obscureText: _obscure,
                  autofocus: true,
                  textInputAction: TextInputAction.next,
                  decoration: InputDecoration(
                    labelText: ref.t('auth.new_password_label'),
                    suffixIcon: IconButton(
                      onPressed: () => setState(() => _obscure = !_obscure),
                      icon: Icon(
                        _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: CustomerSpacing.sm),
                TextField(
                  controller: _confirmController,
                  obscureText: _obscure,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => isLoading ? null : _submit(),
                  decoration: InputDecoration(
                    labelText: ref.t('auth.confirm_password_label'),
                    errorText: _error,
                  ),
                  onChanged: (_) {
                    if (_error != null) setState(() => _error = null);
                  },
                ),
                const SizedBox(height: CustomerSpacing.xl),
                AppButton(
                  label: ref.t('auth.create_password_continue'),
                  isLoading: isLoading,
                  onPressed: isLoading ? null : _submit,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
