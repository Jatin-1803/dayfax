import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/push/push_notifications.dart';
import '../../../../core/i18n/app_locale.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/app_controls/app_gate.dart';
import '../../../../core/routing/auth_gate.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_phone_field.dart';
import '../../../auth/domain/auth_models.dart';
import '../../../auth/presentation/auth_view_model.dart';
import '../../../notifications/presentation/notifications_view_model.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(notificationsUnreadCountProvider);
    final locale = ref.watch(localeControllerProvider).value ?? AppLocale.en;
    final userAsync = ref.watch(currentUserProvider);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('profile.title'))),
      body: ListView(
        padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
        children: [
          userAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: CustomerSpacing.lg),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (_, _) => _ProfileHeader(
              title: ref.t('profile.customer_title'),
              subtitle: ref.t('profile.customer_subtitle'),
            ),
            data: (user) => _ProfileHeader(
              title: (user.fullName?.trim().isNotEmpty ?? false)
                  ? user.fullName!.trim()
                  : ref.t('profile.customer_title'),
              subtitle: _profileSubtitle(ref, user),
            ),
          ),
          const SizedBox(height: CustomerSpacing.lg),
          Text(ref.t('profile.account'), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: CustomerSpacing.sm),
          _ProfileTile(
            icon: Icons.badge_outlined,
            title: ref.t('profile.edit_name'),
            subtitle: ref.t('profile.edit_name_subtitle'),
            onTap: () => _showEditNameSheet(context, ref, userAsync.value),
          ),
          if (userAsync.value != null && !userAsync.value!.hasPhone)
            _ProfileTile(
              icon: Icons.phone_android_outlined,
              title: ref.t('profile.add_phone'),
              subtitle: ref.t('profile.add_phone_subtitle'),
              onTap: () => _showAddPhoneSheet(context, ref),
            ),
          _ProfileTile(
            icon: Icons.lock_outline,
            title: userAsync.value?.hasPassword == true
                ? ref.t('profile.change_password')
                : ref.t('profile.set_password'),
            subtitle: userAsync.value?.hasPassword == true
                ? ref.t('profile.change_password_subtitle')
                : ref.t('profile.set_password_subtitle'),
            onTap: () => _showPasswordSheet(
              context,
              ref,
              hasPassword: userAsync.value?.hasPassword == true,
            ),
          ),
          const SizedBox(height: CustomerSpacing.lg),
          Text(ref.t('common.language'), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: CustomerSpacing.sm),
          SegmentedButton<AppLocale>(
            segments: [
              ButtonSegment(
                value: AppLocale.en,
                label: Text(ref.t('common.language_en')),
                icon: const Icon(Icons.language, size: 18),
              ),
              ButtonSegment(
                value: AppLocale.hi,
                label: Text(ref.t('common.language_hi')),
                icon: const Icon(Icons.translate, size: 18),
              ),
            ],
            selected: {locale},
            onSelectionChanged: (selected) {
              final next = selected.first;
              ref.read(localeControllerProvider.notifier).setLocale(next);
            },
          ),
          const SizedBox(height: CustomerSpacing.xs),
          Text(
            ref.t('common.choose_language'),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: CustomerColors.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: CustomerSpacing.lg),
          Text(ref.t('profile.quick_actions'), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: CustomerSpacing.sm),
          _ProfileTile(
            icon: Icons.receipt_long_outlined,
            title: ref.t('profile.your_orders'),
            subtitle: ref.t('profile.track_reorder'),
            onTap: () => context.go('/orders'),
          ),
          _ProfileTile(
            icon: Icons.location_on_outlined,
            title: ref.t('profile.saved_addresses'),
            subtitle: ref.t('profile.delivery_locations'),
            onTap: () => context.push('/addresses'),
          ),
          _ProfileTile(
            icon: Icons.notifications_outlined,
            title: ref.t('profile.notifications'),
            subtitle: unread > 0
                ? ref.t('profile.unread_count', {'count': '$unread'})
                : ref.t('profile.order_updates'),
            badge: unread > 0,
            onTap: () => context.push('/notifications'),
          ),
          _ProfileTile(
            icon: Icons.shopping_cart_outlined,
            title: ref.t('profile.your_cart'),
            subtitle: ref.t('profile.review_items'),
            onTap: () => context.go('/cart'),
          ),
          const SizedBox(height: CustomerSpacing.lg),
          Text(ref.t('profile.support'), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: CustomerSpacing.sm),
          _ProfileTile(
            icon: Icons.help_outline,
            title: ref.t('profile.help'),
            subtitle: ref.t('profile.help_subtitle'),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(ref.t('profile.help_snackbar'))),
              );
            },
          ),
          const SizedBox(height: CustomerSpacing.lg),
          _ProfileTile(
            icon: Icons.devices_outlined,
            title: ref.t('profile.devices'),
            subtitle: ref.t('profile.devices_subtitle'),
            onTap: () => _showDevices(context),
          ),
          const SizedBox(height: CustomerSpacing.xl),
          AppButton(
            label: ref.t('common.log_out'),
            variant: AppButtonVariant.outline,
            onPressed: () async {
              await ref.read(pushNotificationsProvider).unregister(ref.read(dioProvider));
              await ref.read(authRepositoryProvider).logout();
              ref.read(isAuthenticatedProvider.notifier).state = false;
              ref.read(pendingPasswordSetupProvider.notifier).state = false;
              ref.read(appRoleProvider.notifier).state = AppRole.customer;
              ref.invalidate(sessionBootstrapProvider);
              ref.invalidate(currentUserProvider);
              if (context.mounted) context.go('/login');
            },
          ),
        ],
      ),
    );
  }
}

String _profileSubtitle(WidgetRef ref, AuthUser user) {
  if (user.hasPhone) {
    return _maskedPhone(user);
  }
  final email = user.email?.trim();
  if (email != null && email.isNotEmpty) return email;
  return ref.t('profile.no_phone');
}

String _maskedPhone(AuthUser user) {
  final digits = (user.phone ?? '').replaceAll(RegExp(r'\D'), '');
  final code = user.phoneCountryCode ?? '+91';
  if (digits.length < 10) return '$code $digits';
  return '$code ${digits.substring(0, 2)}******${digits.substring(8)}';
}

void _showAddPhoneSheet(BuildContext context, WidgetRef ref) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (_) => const _AddPhoneSheet(),
  );
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(CustomerSpacing.lg),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            CustomerColors.primaryContainer.withValues(alpha: 0.35),
            CustomerColors.surfaceContainerLowest,
          ],
        ),
        borderRadius: BorderRadius.circular(CustomerRadius.md),
        border: Border.all(
          color: CustomerColors.primaryContainer.withValues(alpha: 0.45),
        ),
      ),
      child: Row(
        children: [
          const CircleAvatar(
            radius: 28,
            backgroundColor: CustomerColors.primaryContainer,
            child: Icon(Icons.person, size: 28, color: CustomerColors.onPrimaryContainer),
          ),
          const SizedBox(width: CustomerSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: CustomerColors.onSurfaceVariant,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

void _showEditNameSheet(BuildContext context, WidgetRef ref, AuthUser? user) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (_) => _EditNameSheet(initialName: user?.fullName ?? ''),
  );
}

void _showPasswordSheet(
  BuildContext context,
  WidgetRef ref, {
  required bool hasPassword,
}) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (_) => _PasswordSheet(hasPassword: hasPassword),
  );
}

class _AddPhoneSheet extends ConsumerStatefulWidget {
  const _AddPhoneSheet();

  @override
  ConsumerState<_AddPhoneSheet> createState() => _AddPhoneSheetState();
}

class _AddPhoneSheetState extends ConsumerState<_AddPhoneSheet> {
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  String? _error;
  var _busy = false;
  var _otpSent = false;
  String? _devOtp;

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _saveDirect() async {
    final normalized = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(normalized)) {
      setState(() => _error = ref.tr('auth.invalid_phone'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authRepositoryProvider).linkPhoneDirect(phone: normalized);
      ref.invalidate(currentUserProvider);
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.t('profile.phone_linked'))),
      );
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = ref.tr(failure.message);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = ref.tr('error.generic');
      });
    }
  }

  Future<void> _requestOtp() async {
    final normalized = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(normalized)) {
      setState(() => _error = ref.tr('auth.invalid_phone'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final data = await ref.read(authRepositoryProvider).requestLinkPhone(phone: normalized);
      if (!mounted) return;
      setState(() {
        _busy = false;
        _otpSent = true;
        _devOtp = data['devOtp']?.toString();
      });
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = ref.tr(failure.message);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = ref.tr('error.generic');
      });
    }
  }

  Future<void> _verifyOtp() async {
    final normalized = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    final otp = _otpController.text.trim();
    if (!RegExp(r'^\d{4,6}$').hasMatch(otp)) {
      setState(() => _error = ref.tr('auth.enter_otp'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authRepositoryProvider).verifyLinkPhone(
            phone: normalized,
            otp: otp,
          );
      ref.invalidate(currentUserProvider);
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.t('profile.phone_linked'))),
      );
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = ref.tr(failure.message);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = ref.tr('error.generic');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final otpEnabled = ref.watch(loginOtpEnabledProvider);
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        CustomerSpacing.marginMobile,
        0,
        CustomerSpacing.marginMobile,
        CustomerSpacing.lg + bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            ref.t('profile.add_phone'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: CustomerSpacing.sm),
          Text(
            ref.t('profile.add_phone_subtitle'),
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: CustomerColors.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: CustomerSpacing.lg),
          AppPhoneField(
            controller: _phoneController,
            errorText: _otpSent ? null : _error,
            onChanged: (_) {
              if (_error != null) setState(() => _error = null);
            },
          ),
          if (otpEnabled && _otpSent) ...[
            const SizedBox(height: CustomerSpacing.md),
            TextField(
              controller: _otpController,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: InputDecoration(
                labelText: ref.t('auth.verify_otp'),
                errorText: _error,
                counterText: '',
              ),
              onChanged: (_) {
                if (_error != null) setState(() => _error = null);
              },
            ),
            if (_devOtp != null) ...[
              const SizedBox(height: CustomerSpacing.xs),
              Text(
                'Dev OTP: $_devOtp',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: CustomerColors.onSurfaceVariant,
                    ),
              ),
            ],
          ],
          const SizedBox(height: CustomerSpacing.lg),
          AppButton(
            label: !otpEnabled
                ? ref.t('profile.phone_save')
                : (_otpSent ? ref.t('auth.verify_continue') : ref.t('auth.continue')),
            isLoading: _busy,
            onPressed: _busy
                ? null
                : (!otpEnabled
                    ? _saveDirect
                    : (_otpSent ? _verifyOtp : _requestOtp)),
          ),
          if (otpEnabled && _otpSent) ...[
            const SizedBox(height: CustomerSpacing.sm),
            TextButton(
              onPressed: _busy ? null : _requestOtp,
              child: Text(ref.t('auth.resend_code')),
            ),
          ],
        ],
      ),
    );
  }
}

class _EditNameSheet extends ConsumerStatefulWidget {
  const _EditNameSheet({required this.initialName});

  final String initialName;

  @override
  ConsumerState<_EditNameSheet> createState() => _EditNameSheetState();
}

class _EditNameSheetState extends ConsumerState<_EditNameSheet> {
  late final TextEditingController _controller;
  String? _error;
  var _busy = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialName);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _controller.text.trim();
    if (name.isEmpty) {
      setState(() => _error = ref.tr('profile.name_required'));
      return;
    }
    if (name.length > 120) {
      setState(() => _error = ref.tr('profile.name_too_long'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authRepositoryProvider).updateProfile(fullName: name);
      ref.invalidate(currentUserProvider);
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.t('profile.name_updated'))),
      );
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = ref.tr(failure.message);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = ref.tr('error.generic');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        CustomerSpacing.marginMobile,
        0,
        CustomerSpacing.marginMobile,
        CustomerSpacing.lg + bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(ref.t('profile.edit_name'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: CustomerSpacing.md),
          TextField(
            controller: _controller,
            autofocus: true,
            textCapitalization: TextCapitalization.words,
            maxLength: 120,
            decoration: InputDecoration(
              labelText: ref.t('profile.name_label'),
              errorText: _error,
            ),
            onChanged: (_) {
              if (_error != null) setState(() => _error = null);
            },
          ),
          const SizedBox(height: CustomerSpacing.md),
          AppButton(
            label: ref.t('common.save'),
            isLoading: _busy,
            onPressed: _busy ? null : _save,
          ),
        ],
      ),
    );
  }
}

class _PasswordSheet extends ConsumerStatefulWidget {
  const _PasswordSheet({required this.hasPassword});

  final bool hasPassword;

  @override
  ConsumerState<_PasswordSheet> createState() => _PasswordSheetState();
}

class _PasswordSheetState extends ConsumerState<_PasswordSheet> {
  final _currentController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  String? _error;
  var _busy = false;
  var _obscure = true;

  @override
  void dispose() {
    _currentController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final password = _passwordController.text;
    final confirm = _confirmController.text;
    if (password.length < 8) {
      setState(() => _error = ref.tr('auth.password_too_short'));
      return;
    }
    if (password != confirm) {
      setState(() => _error = ref.tr('auth.password_mismatch'));
      return;
    }
    if (widget.hasPassword && _currentController.text.isEmpty) {
      setState(() => _error = ref.tr('auth.current_password_required'));
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final repo = ref.read(authRepositoryProvider);
      if (widget.hasPassword) {
        await repo.changePassword(
          currentPassword: _currentController.text,
          password: password,
          confirmPassword: confirm,
        );
      } else {
        await repo.setPassword(password: password, confirmPassword: confirm);
      }
      ref.invalidate(currentUserProvider);
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            ref.t(widget.hasPassword ? 'profile.password_changed' : 'profile.password_set'),
          ),
        ),
      );
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = ref.tr(failure.message);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = ref.tr('error.generic');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        CustomerSpacing.marginMobile,
        0,
        CustomerSpacing.marginMobile,
        CustomerSpacing.lg + bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              ref.t(widget.hasPassword ? 'profile.change_password' : 'profile.set_password'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: CustomerSpacing.md),
            if (widget.hasPassword) ...[
              TextField(
                controller: _currentController,
                obscureText: _obscure,
                decoration: InputDecoration(
                  labelText: ref.t('auth.current_password_label'),
                ),
              ),
              const SizedBox(height: CustomerSpacing.sm),
            ],
            TextField(
              controller: _passwordController,
              obscureText: _obscure,
              decoration: InputDecoration(
                labelText: ref.t('auth.new_password_label'),
                suffixIcon: IconButton(
                  onPressed: () => setState(() => _obscure = !_obscure),
                  icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                ),
              ),
            ),
            const SizedBox(height: CustomerSpacing.sm),
            TextField(
              controller: _confirmController,
              obscureText: _obscure,
              decoration: InputDecoration(
                labelText: ref.t('auth.confirm_password_label'),
                errorText: _error,
              ),
              onChanged: (_) {
                if (_error != null) setState(() => _error = null);
              },
            ),
            const SizedBox(height: CustomerSpacing.md),
            AppButton(
              label: ref.t('common.save'),
              isLoading: _busy,
              onPressed: _busy ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}

void _showDevices(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (_) => const _DevicesSheet(),
  );
}

class _DevicesSheet extends ConsumerStatefulWidget {
  const _DevicesSheet();

  @override
  ConsumerState<_DevicesSheet> createState() => _DevicesSheetState();
}

class _DevicesSheetState extends ConsumerState<_DevicesSheet> {
  List<Map<dynamic, dynamic>> _sessions = const [];
  var _loading = true;
  var _failed = false;
  var _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      final response = await ref.read(dioProvider).get<Map<String, dynamic>>('/auth/sessions');
      final data = response.data?['data'];
      if (!mounted) return;
      setState(() {
        _sessions = data is List
            ? data.whereType<Map>().map((row) => Map<dynamic, dynamic>.from(row)).toList()
            : const [];
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _failed = true;
      });
    }
  }

  Future<bool> _confirm({required String title, required String message, required String action}) {
    return showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(ref.t('common.cancel')),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(action),
          ),
        ],
      ),
    ).then((value) => value == true);
  }

  Future<void> _finish(String message) async {
    final messenger = ScaffoldMessenger.of(context);
    if (!mounted) return;
    Navigator.of(context).pop();
    messenger.showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _revokeOne(String sessionId) async {
    if (_busy) return;
    final confirmed = await _confirm(
      title: ref.t('profile.sign_out_device'),
      message: ref.t('profile.sign_out_device_confirm'),
      action: ref.t('profile.sign_out_device'),
    );
    if (!confirmed || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref.read(dioProvider).post('/auth/sessions/$sessionId/revoke');
      if (!mounted) return;
      await _finish(ref.t('profile.device_signed_out'));
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.t('error.generic'))),
      );
    }
  }

  Future<void> _revokeOthers() async {
    if (_busy) return;
    final confirmed = await _confirm(
      title: ref.t('profile.sign_out_others'),
      message: ref.t('profile.sign_out_others_confirm'),
      action: ref.t('profile.sign_out_device'),
    );
    if (!confirmed || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref.read(dioProvider).post('/auth/sessions/revoke-others');
      if (!mounted) return;
      await _finish(ref.t('profile.others_signed_out'));
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.t('error.generic'))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.only(bottom: CustomerSpacing.lg),
        children: [
          ListTile(
            title: Text(ref.t('profile.devices')),
            subtitle: Text(ref.t('profile.devices_subtitle')),
          ),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: CustomerSpacing.xl),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_failed)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                CustomerSpacing.md,
                CustomerSpacing.sm,
                CustomerSpacing.md,
                0,
              ),
              child: Column(
                children: [
                  Text(ref.t('error.generic')),
                  const SizedBox(height: CustomerSpacing.sm),
                  AppButton(
                    label: ref.t('common.retry'),
                    onPressed: _busy ? null : _load,
                  ),
                ],
              ),
            )
          else ...[
            if (_sessions.isEmpty) ListTile(title: Text(ref.t('profile.devices_empty'))),
            for (final raw in _sessions)
              ListTile(
                title: Text(_deviceLabel(raw, ref)),
                subtitle: Text(_deviceSubtitle(raw)),
                trailing: raw['current'] == true
                    ? Text(ref.t('profile.this_device'))
                    : TextButton(
                        onPressed: _busy ? null : () => _revokeOne('${raw['id']}'),
                        child: Text(ref.t('profile.sign_out_device')),
                      ),
              ),
            if (_sessions.length > 1)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  CustomerSpacing.md,
                  CustomerSpacing.sm,
                  CustomerSpacing.md,
                  0,
                ),
                child: AppButton(
                  label: ref.t('profile.sign_out_others'),
                  variant: AppButtonVariant.outline,
                  onPressed: _busy ? null : _revokeOthers,
                ),
              ),
          ],
        ],
      ),
    );
  }
}

String _deviceLabel(Map raw, WidgetRef ref) {
  final name = raw['deviceName'];
  if (name is String && name.trim().isNotEmpty) return name;
  final platform = '${raw['platform'] ?? ''}'.toLowerCase();
  if (platform == 'ios') return 'iPhone';
  if (platform == 'android') return 'Android';
  return ref.t('profile.unknown_device');
}

String _deviceSubtitle(Map raw) {
  final platform = '${raw['platform'] ?? ''}'.toLowerCase();
  final label = platform == 'ios' ? 'iOS' : platform == 'android' ? 'Android' : platform;
  final version = raw['appVersion'];
  if (version == null || '$version'.isEmpty) return label;
  return '$label · $version';
}

class _ProfileTile extends StatelessWidget {
  const _ProfileTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.badge = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final bool badge;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: CustomerSpacing.sm),
      child: Material(
        color: CustomerColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(CustomerRadius.md),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(CustomerRadius.md),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(CustomerRadius.md),
              border: Border.all(
                color: CustomerColors.outlineVariant.withValues(alpha: 0.3),
              ),
            ),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: CustomerColors.surfaceContainer,
                child: Icon(icon, color: CustomerColors.primary, size: 22),
              ),
              title: Text(
                title,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              subtitle: Text(subtitle),
              trailing: badge
                  ? const Badge(smallSize: 8, child: Icon(Icons.chevron_right))
                  : const Icon(Icons.chevron_right),
            ),
          ),
        ),
      ),
    );
  }
}
