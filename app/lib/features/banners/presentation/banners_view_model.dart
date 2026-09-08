import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/i18n_providers.dart';
import '../data/banners_repository.dart';
import '../domain/banner_models.dart';

sealed class HomeBannersState {
  const HomeBannersState();
}

class HomeBannersLoading extends HomeBannersState {
  const HomeBannersLoading();
}

class HomeBannersReady extends HomeBannersState {
  const HomeBannersReady(this.banners);

  final List<HomeBanner> banners;
}

class HomeBannersUnavailable extends HomeBannersState {
  const HomeBannersUnavailable();
}

class HomeBannersViewModel extends Notifier<HomeBannersState> {
  @override
  HomeBannersState build() {
    ref.listen(appLangCodeProvider, (previous, next) {
      if (previous != null && previous != next) {
        unawaited(load());
      }
    });
    Future.microtask(load);
    return const HomeBannersLoading();
  }

  Future<void> load() async {
    final previous = state;
    try {
      final banners = await ref.read(bannersRepositoryProvider).listActive(
            lang: ref.read(appLangCodeProvider),
          );
      state = HomeBannersReady(banners);
    } catch (_) {
      if (previous is HomeBannersReady) return;
      state = const HomeBannersUnavailable();
    }
  }
}

final homeBannersViewModelProvider =
    NotifierProvider<HomeBannersViewModel, HomeBannersState>(HomeBannersViewModel.new);
