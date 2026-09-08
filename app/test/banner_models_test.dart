import 'package:dailyfax/features/banners/domain/banner_models.dart';
import 'package:dailyfax/features/banners/presentation/banners_view_model.dart';
import 'package:dailyfax/features/banners/presentation/widgets/home_top_banner.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('HomeBanner parses the public payload and ignores external links', () {
    final banner = HomeBanner.fromJson({
      'id': 'b7e4c2a1-6f3d-4a8e-9c1b-2d5e7f8a9012',
      'title': 'Groceries at your door',
      'imageUrl': 'https://example.com/banner.webp',
      'linkPath': '/categories',
      'priority': 10,
    });

    expect(banner.title, 'Groceries at your door');
    expect(banner.tapPath, '/categories');
    expect(banner.priority, 10);

    final external = HomeBanner.fromJson({
      'id': 'x',
      'title': 'Offer',
      'imageUrl': 'https://example.com/banner.webp',
      'linkPath': 'https://example.com',
      'priority': 1,
    });
    expect(external.tapPath, isNull);
  });

  test('HomeBanner skips an empty image', () {
    final banner = HomeBanner.fromJson({
      'id': 'x',
      'title': 'Offer',
      'imageUrl': '',
      'priority': 0,
    });
    expect(banner.imageUrl, isEmpty);
  });

  testWidgets('Home banner is hidden when none are active', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          homeBannersViewModelProvider.overrideWith(_EmptyBanners.new),
        ],
        child: const MaterialApp(home: Scaffold(body: HomeTopBanner())),
      ),
    );
    await tester.pump();

    expect(find.byType(AspectRatio), findsNothing);
  });

  testWidgets('Home banner is hidden when the banner API fails', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          homeBannersViewModelProvider.overrideWith(_FailedBanners.new),
        ],
        child: const MaterialApp(home: Scaffold(body: HomeTopBanner())),
      ),
    );
    await tester.pump();

    expect(find.byType(AspectRatio), findsNothing);
  });
}

class _EmptyBanners extends HomeBannersViewModel {
  @override
  HomeBannersState build() => const HomeBannersReady([]);
}

class _FailedBanners extends HomeBannersViewModel {
  @override
  HomeBannersState build() => const HomeBannersUnavailable();
}
