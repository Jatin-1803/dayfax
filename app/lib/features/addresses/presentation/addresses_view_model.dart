import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../data/addresses_repository.dart';
import '../domain/address_models.dart';

class AddressesViewModel extends Notifier<AsyncValue<List<UserAddress>>> {
  @override
  AsyncValue<List<UserAddress>> build() {
    Future.microtask(load);
    return const AsyncValue.loading();
  }

  Future<void> load() async {
    // Keep previous addresses visible so the picker does not flash forever.
    state = AsyncValue<List<UserAddress>>.loading().copyWithPrevious(state);
    try {
      final items = await ref.read(addressesRepositoryProvider).list();
      state = AsyncValue.data(items);
    } on AppFailure catch (failure) {
      state = AsyncValue<List<UserAddress>>.error(
        failure,
        StackTrace.current,
      ).copyWithPrevious(state);
    }
  }

  Future<void> save(AddressDraft draft) async {
    try {
      final repo = ref.read(addressesRepositoryProvider);
      if (draft.id == null) {
        await repo.create(draft.toJson());
      } else {
        await repo.update(draft.id!, draft.toJson());
      }
      await load();
    } on AppFailure {
      rethrow;
    }
  }

  Future<void> remove(String id) async {
    await ref.read(addressesRepositoryProvider).delete(id);
    await load();
  }

  Future<void> makeDefault(String id) async {
    await ref.read(addressesRepositoryProvider).setDefault(id);
    await load();
  }
}

final addressesViewModelProvider =
    NotifierProvider<AddressesViewModel, AsyncValue<List<UserAddress>>>(
  AddressesViewModel.new,
);
