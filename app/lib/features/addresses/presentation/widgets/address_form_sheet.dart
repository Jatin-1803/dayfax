import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_phone_field.dart';
import '../../../auth/presentation/auth_view_model.dart';
import '../../data/location_service.dart';
import '../../domain/address_models.dart';
import '../addresses_view_model.dart';

Future<bool> showAddressFormSheet(
  BuildContext context, {
  UserAddress? initial,
  AddressDraft? prefill,
}) async {
  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    builder: (sheetContext) {
      return _KeyboardInset(
        child: AddressForm(
          initial: initial,
          prefill: prefill,
          onSaved: () => Navigator.pop(sheetContext, true),
        ),
      );
    },
  );
  return saved == true;
}

/// Applies the keyboard inset from [didChangeDependencies], which is the
/// safe place to read ancestors. A bare [MediaQuery.of] in the sheet builder
/// runs again while the route is already deactivated and the keyboard hides.
class _KeyboardInset extends StatefulWidget {
  const _KeyboardInset({required this.child});

  final Widget child;

  @override
  State<_KeyboardInset> createState() => _KeyboardInsetState();
}

class _KeyboardInsetState extends State<_KeyboardInset> {
  var _bottom = 0.0;
  var _sheetHeight = 0.0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final media = MediaQuery.of(context);
    _bottom = media.viewInsets.bottom;
    _sheetHeight = media.size.height * 0.88;
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: _bottom),
      child: SizedBox(
        height: _sheetHeight,
        child: widget.child,
      ),
    );
  }
}

class AddressForm extends ConsumerStatefulWidget {
  const AddressForm({
    super.key,
    this.initial,
    this.prefill,
    this.onSaved,
  });

  final UserAddress? initial;
  final AddressDraft? prefill;
  final VoidCallback? onSaved;

  @override
  ConsumerState<AddressForm> createState() => _AddressFormState();
}

class _AddressFormState extends ConsumerState<AddressForm> {
  late final AddressDraft _draft;
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _line1Controller;
  late final TextEditingController _line2Controller;
  late final TextEditingController _landmarkController;
  late final TextEditingController _cityController;
  late final TextEditingController _stateController;
  late final TextEditingController _pincodeController;
  bool _saving = false;
  bool _locating = false;
  String? _error;
  String? _phoneError;

  @override
  void initState() {
    super.initState();
    if (widget.prefill != null) {
      _draft = widget.prefill!;
    } else if (widget.initial != null) {
      _draft = AddressDraft.fromAddress(widget.initial!);
    } else {
      _draft = AddressDraft();
    }
    if (widget.initial == null) {
      final auth = ref.read(authViewModelProvider);
      if (auth is AuthAuthenticated) {
        if (_draft.fullName.trim().isEmpty) {
          final accountName = auth.session.user.fullName?.trim() ?? '';
          if (accountName.isNotEmpty) _draft.fullName = accountName;
        }
        if (_draft.phone.trim().isEmpty) {
          final accountPhone = auth.session.user.phone?.replaceAll(RegExp(r'\D'), '') ?? '';
          if (accountPhone.isNotEmpty) _draft.phone = accountPhone;
          final accountCode = auth.session.user.phoneCountryCode?.trim();
          if (accountCode != null && accountCode.isNotEmpty) {
            _draft.phoneCountryCode = accountCode;
          }
        }
      }
    }
    _nameController = TextEditingController(text: _draft.fullName);
    _phoneController = TextEditingController(text: _draft.phone);
    _line1Controller = TextEditingController(text: _draft.line1);
    _line2Controller = TextEditingController(text: _draft.line2);
    _landmarkController = TextEditingController(text: _draft.landmark);
    _cityController = TextEditingController(text: _draft.city);
    _stateController = TextEditingController(text: _draft.state);
    _pincodeController = TextEditingController(text: _draft.pincode);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _line1Controller.dispose();
    _line2Controller.dispose();
    _landmarkController.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _pincodeController.dispose();
    super.dispose();
  }

  bool _validatePhone() {
    final normalized = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(normalized)) {
      setState(() => _phoneError = ref.tr('addresses.phone_error'));
      return false;
    }
    setState(() => _phoneError = null);
    return true;
  }

  Future<void> _useCurrentLocation() async {
    setState(() {
      _locating = true;
      _error = null;
    });
    try {
      final service = ref.read(locationServiceProvider);
      await service.ensureReady();
      final resolved = await service.resolveCurrentLocation(
        requestPermission: false,
      );
      if (!mounted) return;
      _draft
        ..line1 = resolved.line1
        ..line2 = resolved.line2
        ..city = resolved.city
        ..state = resolved.state
        ..pincode = resolved.pincode
        ..latitude = resolved.latitude
        ..longitude = resolved.longitude
        ..isDefault = true;
      _line1Controller.text = resolved.line1;
      _line2Controller.text = resolved.line2;
      _cityController.text = resolved.city;
      _stateController.text = resolved.state;
      _pincodeController.text = resolved.pincode;
      setState(() {});
    } on AppFailure catch (failure) {
      if (mounted) setState(() => _error = failure.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'addresses.location_timed_out');
      }
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _save() async {
    final formOk = _formKey.currentState!.validate();
    final phoneOk = _validatePhone();
    if (!formOk || !phoneOk) return;
    _draft
      ..fullName = _nameController.text
      ..phone = _phoneController.text.replaceAll(RegExp(r'\D'), '')
      ..line1 = _line1Controller.text
      ..line2 = _line2Controller.text
      ..landmark = _landmarkController.text
      ..city = _cityController.text
      ..state = _stateController.text
      ..pincode = _pincodeController.text;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(addressesViewModelProvider.notifier).save(_draft);
      if (!mounted) return;
      setState(() => _saving = false);
      // Drop focus before the route unmounts so the keyboard inset
      // change does not look up a deactivated ancestor.
      FocusManager.instance.primaryFocus?.unfocus();
      final onSaved = widget.onSaved;
      if (onSaved != null) {
        onSaved();
      } else {
        Navigator.of(context).pop();
      }
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = failure.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _saving = false);
      rethrow;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.initial != null;
    final hasCoords = _draft.latitude != null && _draft.longitude != null;

    return Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            CustomerSpacing.marginMobile,
            0,
            CustomerSpacing.marginMobile,
            CustomerSpacing.lg,
          ),
          children: [
            Text(
              isEdit ? ref.t('addresses.edit') : ref.t('addresses.add_title'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: CustomerSpacing.md),
            OutlinedButton.icon(
              onPressed: _locating || _saving ? null : _useCurrentLocation,
              icon: _locating
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.my_location),
              label: Text(
                _locating ? ref.t('addresses.detecting') : ref.t('addresses.use_current'),
              ),
            ),
            if (hasCoords) ...[
              const SizedBox(height: CustomerSpacing.sm),
              Row(
                children: [
                  const Icon(Icons.check_circle, size: 16, color: CustomerColors.primary),
                  const SizedBox(width: CustomerSpacing.xs),
                  Text(
                    ref.t('addresses.pinned'),
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          color: CustomerColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: CustomerSpacing.lg),
            TextFormField(
              controller: _nameController,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
              decoration: InputDecoration(labelText: ref.t('addresses.full_name')),
              validator: (value) => (value == null || value.trim().length < 2)
                  ? ref.tr('addresses.full_name_error')
                  : null,
            ),
            const SizedBox(height: CustomerSpacing.md),
            Text(
              ref.t('addresses.phone'),
              style: Theme.of(context).textTheme.labelLarge,
            ),
            const SizedBox(height: CustomerSpacing.sm),
            AppPhoneField(
              controller: _phoneController,
              countryCode: _draft.phoneCountryCode,
              hintText: ref.t('auth.phone_hint'),
              errorText: _phoneError,
              onChanged: (_) {
                if (_phoneError != null) {
                  setState(() => _phoneError = null);
                }
              },
            ),
            const SizedBox(height: CustomerSpacing.md),
            DropdownButtonFormField<String>(
              initialValue: _draft.label,
              items: [
                DropdownMenuItem(value: 'Home', child: Text(ref.t('addresses.label_home'))),
                DropdownMenuItem(value: 'Work', child: Text(ref.t('addresses.label_work'))),
                DropdownMenuItem(value: 'Other', child: Text(ref.t('addresses.label_other'))),
              ],
              onChanged: (value) => setState(() => _draft.label = value ?? 'Home'),
              decoration: InputDecoration(labelText: ref.t('addresses.label')),
            ),
            const SizedBox(height: CustomerSpacing.md),
            TextFormField(
              controller: _line1Controller,
              decoration: InputDecoration(labelText: ref.t('addresses.line1')),
              validator: (value) =>
                  (value == null || value.trim().length < 3) ? ref.tr('addresses.line1_error') : null,
            ),
            const SizedBox(height: CustomerSpacing.md),
            TextFormField(
              controller: _line2Controller,
              decoration: InputDecoration(labelText: ref.t('addresses.line2')),
            ),
            const SizedBox(height: CustomerSpacing.md),
            TextFormField(
              controller: _landmarkController,
              decoration: InputDecoration(labelText: ref.t('addresses.landmark')),
            ),
            const SizedBox(height: CustomerSpacing.md),
            TextFormField(
              controller: _cityController,
              decoration: InputDecoration(labelText: ref.t('addresses.city')),
              validator: (value) =>
                  (value == null || value.trim().length < 2) ? ref.tr('addresses.city_error') : null,
            ),
            const SizedBox(height: CustomerSpacing.md),
            TextFormField(
              controller: _stateController,
              decoration: InputDecoration(labelText: ref.t('addresses.state')),
            ),
            const SizedBox(height: CustomerSpacing.md),
            TextFormField(
              controller: _pincodeController,
              decoration: InputDecoration(labelText: ref.t('addresses.pincode')),
              keyboardType: TextInputType.number,
              validator: (value) {
                if (value == null || value.trim().isEmpty) return null;
                return RegExp(r'^\d{6}$').hasMatch(value.trim())
                    ? null
                    : ref.tr('addresses.pincode_hint');
              },
            ),
            const SizedBox(height: CustomerSpacing.md),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(ref.t('addresses.set_default')),
              value: _draft.isDefault,
              onChanged: (value) => setState(() => _draft.isDefault = value),
            ),
            if (_error != null) ...[
              const SizedBox(height: CustomerSpacing.sm),
              Text(ref.t(_error!), style: const TextStyle(color: CustomerColors.error)),
            ],
            const SizedBox(height: CustomerSpacing.lg),
            AppButton(
              label: isEdit ? ref.t('addresses.save_changes') : ref.t('addresses.save'),
              isLoading: _saving,
              onPressed: _saving || _locating ? null : _save,
            ),
          ],
        ),
    );
  }
}
