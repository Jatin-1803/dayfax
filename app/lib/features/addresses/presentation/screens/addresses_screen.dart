import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_radius.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../domain/address_models.dart';
import '../addresses_view_model.dart';
import '../widgets/address_form_sheet.dart';

class AddressesScreen extends ConsumerWidget {
  const AddressesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncAddresses = ref.watch(addressesViewModelProvider);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('addresses.title'))),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showAddressFormSheet(context),
        icon: const Icon(Icons.add),
        label: Text(ref.t('common.add')),
      ),
      body: asyncAddresses.when(
        skipLoadingOnReload: true,
        skipLoadingOnRefresh: true,
        loading: () => ListView.separated(
          padding: const EdgeInsets.fromLTRB(
            CustomerSpacing.marginMobile,
            CustomerSpacing.lg,
            CustomerSpacing.marginMobile,
            100,
          ),
          itemCount: 4,
          separatorBuilder: (_, _) => const SizedBox(height: CustomerSpacing.md),
          itemBuilder: (_, _) => const ListCardSkeleton(height: 108),
        ),
        error: (error, _) => ErrorState(
          message: error is AppFailure ? error.message : 'addresses.could_not_load',
          onRetry: () => ref.read(addressesViewModelProvider.notifier).load(),
        ),
        data: (addresses) {
          if (addresses.isEmpty) {
            return EmptyState(
              title: ref.t('addresses.empty_title'),
              message: ref.t('addresses.empty_message'),
              actionLabel: ref.t('addresses.add'),
              onAction: () => showAddressFormSheet(context),
            );
          }
          return RefreshIndicator(
            color: CustomerColors.primary,
            onRefresh: () => ref.read(addressesViewModelProvider.notifier).load(),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                CustomerSpacing.marginMobile,
                CustomerSpacing.lg,
                CustomerSpacing.marginMobile,
                100,
              ),
              itemCount: addresses.length,
              separatorBuilder: (_, _) => const SizedBox(height: CustomerSpacing.md),
              itemBuilder: (context, index) {
                final address = addresses[index];
                return _AddressCard(
                  address: address,
                  onEdit: () => showAddressFormSheet(context, initial: address),
                  onDefault: address.isDefault
                      ? null
                      : () => ref.read(addressesViewModelProvider.notifier).makeDefault(address.id),
                  onDelete: () async {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (dialogContext) => AlertDialog(
                        title: Text(dialogContext.t('addresses.delete_title')),
                        content: Text(
                          dialogContext.t('addresses.delete_message', {'label': address.label}),
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(dialogContext, false),
                            child: Text(dialogContext.t('common.cancel')),
                          ),
                          TextButton(
                            onPressed: () => Navigator.pop(dialogContext, true),
                            child: Text(dialogContext.t('common.delete')),
                          ),
                        ],
                      ),
                    );
                    if (ok == true) {
                      await ref.read(addressesViewModelProvider.notifier).remove(address.id);
                    }
                  },
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _AddressCard extends StatelessWidget {
  const _AddressCard({
    required this.address,
    required this.onEdit,
    required this.onDelete,
    this.onDefault,
  });

  final UserAddress address;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback? onDefault;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: CustomerColors.surfaceContainerLowest,
      borderRadius: BorderRadius.circular(CustomerRadius.lg),
      child: Padding(
        padding: const EdgeInsets.all(CustomerSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    address.fullName?.trim().isNotEmpty == true
                        ? '${address.label} · ${address.fullName}'
                        : address.label,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                if (address.isDefault) ...[
                  const SizedBox(width: CustomerSpacing.sm),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: CustomerSpacing.sm,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: CustomerColors.primaryContainer,
                      borderRadius: BorderRadius.circular(CustomerRadius.full),
                    ),
                    child: Text(
                      context.t('common.default'),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: CustomerColors.onPrimaryContainer,
                          ),
                    ),
                  ),
                ],
                IconButton(onPressed: onEdit, icon: const Icon(Icons.edit_outlined)),
                IconButton(onPressed: onDelete, icon: const Icon(Icons.delete_outline)),
              ],
            ),
            Text(
              address.summaryLine,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: CustomerColors.onSurfaceVariant,
                  ),
            ),
            if (onDefault != null) ...[
              const SizedBox(height: CustomerSpacing.md),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: onDefault,
                  child: Text(context.t('addresses.set_default')),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class AddressEditScreen extends StatelessWidget {
  const AddressEditScreen({super.key, this.initial, this.prefill});

  final UserAddress? initial;
  final AddressDraft? prefill;

  @override
  Widget build(BuildContext context) {
    final isEdit = initial != null;
    return Scaffold(
      appBar: AppBar(
        title: Text(context.t(isEdit ? 'addresses.edit' : 'addresses.add_title')),
      ),
      body: AddressForm(
        initial: initial,
        prefill: prefill,
        onSaved: () => Navigator.of(context).pop(),
      ),
    );
  }
}
