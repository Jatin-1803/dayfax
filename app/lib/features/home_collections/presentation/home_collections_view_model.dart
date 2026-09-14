import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/i18n_providers.dart';
import '../data/home_collections_repository.dart';
import '../domain/home_collection_models.dart';

sealed class HomeCollectionState {
  const HomeCollectionState();
}

class HomeCollectionLoading extends HomeCollectionState {
  const HomeCollectionLoading();
}

class HomeCollectionReady extends HomeCollectionState {
  const HomeCollectionReady(this.collection);

  final HomeCollection? collection;
}

class HomeCollectionUnavailable extends HomeCollectionState {
  const HomeCollectionUnavailable();
}

class HomeCollectionsViewModel extends Notifier<HomeCollectionState> {
  @override
  HomeCollectionState build() {
    ref.listen(appLangCodeProvider, (previous, next) {
      if (previous != null && previous != next) {
        unawaited(load());
      }
    });
    Future.microtask(load);
    return const HomeCollectionLoading();
  }

  Future<void> load() async {
    final previous = state;
    try {
      final collection = await ref.read(homeCollectionsRepositoryProvider).getActive(
            lang: ref.read(appLangCodeProvider),
          );
      state = HomeCollectionReady(collection);
    } catch (_) {
      if (previous is HomeCollectionReady) return;
      state = const HomeCollectionUnavailable();
    }
  }
}

final homeCollectionsViewModelProvider =
    NotifierProvider<HomeCollectionsViewModel, HomeCollectionState>(
  HomeCollectionsViewModel.new,
);
