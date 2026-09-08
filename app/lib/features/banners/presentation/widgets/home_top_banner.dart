import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_radius.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../domain/banner_models.dart';
import '../banners_view_model.dart';

const double kHomeBannerAspectRatio = 2.4;

class HomeTopBanner extends ConsumerStatefulWidget {
  const HomeTopBanner({super.key});

  @override
  ConsumerState<HomeTopBanner> createState() => _HomeTopBannerState();
}

class _HomeTopBannerState extends ConsumerState<HomeTopBanner> {
  final PageController _pages = PageController();
  final Set<String> _failedIds = <String>{};
  int _index = 0;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  void _markFailed(String id) {
    if (_failedIds.contains(id) || !mounted) return;
    setState(() {
      _failedIds.add(id);
      _index = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    final bannerState = ref.watch(homeBannersViewModelProvider);
    final banners = switch (bannerState) {
      HomeBannersReady(:final banners) => banners
          .where((banner) => banner.imageUrl.isNotEmpty && !_failedIds.contains(banner.id))
          .toList(),
      _ => const <HomeBanner>[],
    };

    if (banners.isEmpty) return const SizedBox.shrink();

    final page = _index.clamp(0, banners.length - 1);

    return Column(
      children: [
        const SizedBox(height: CustomerSpacing.lg),
        DecoratedBox(
          decoration: BoxDecoration(
            color: CustomerColors.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(CustomerRadius.md),
            border: Border.all(
              color: CustomerColors.outlineVariant.withValues(alpha: 0.28),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 10,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(CustomerRadius.md),
            child: AspectRatio(
              aspectRatio: kHomeBannerAspectRatio,
              child: banners.length == 1
                  ? _BannerSlide(
                      banner: banners.first,
                      onImageFailed: () => _markFailed(banners.first.id),
                    )
                  : PageView.builder(
                      controller: _pages,
                      itemCount: banners.length,
                      onPageChanged: (index) => setState(() => _index = index),
                      itemBuilder: (context, index) {
                        final banner = banners[index];
                        return _BannerSlide(
                          banner: banner,
                          onImageFailed: () => _markFailed(banner.id),
                        );
                      },
                    ),
            ),
          ),
        ),
        if (banners.length > 1) ...[
          const SizedBox(height: CustomerSpacing.sm),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < banners.length; i++)
                Semantics(
                  label: ref.t('home.banner_page', {
                    'current': '${i + 1}',
                    'total': '${banners.length}',
                  }),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      width: i == page ? 16 : 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: i == page
                            ? CustomerColors.primary
                            : CustomerColors.outlineVariant,
                        borderRadius: BorderRadius.circular(CustomerRadius.full),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _BannerSlide extends ConsumerWidget {
  const _BannerSlide({
    required this.banner,
    required this.onImageFailed,
  });

  final HomeBanner banner;
  final VoidCallback onImageFailed;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tapPath = banner.tapPath;
    final label = banner.title.trim().isEmpty
        ? ref.t('home.banner_promo')
        : banner.title;

    final image = CachedNetworkImage(
      imageUrl: banner.imageUrl,
      fit: BoxFit.cover,
      fadeInDuration: const Duration(milliseconds: 180),
      memCacheWidth: 1440,
      placeholder: (context, url) => const ColoredBox(color: CustomerColors.surfaceContainerLow),
      errorWidget: (context, url, error) {
        WidgetsBinding.instance.addPostFrameCallback((_) => onImageFailed());
        return const ColoredBox(color: CustomerColors.surfaceContainerLow);
      },
    );

    return Semantics(
      button: tapPath != null,
      label: label,
      child: Material(
        color: CustomerColors.surfaceContainerLow,
        child: tapPath == null
            ? image
            : InkWell(
                onTap: () => context.push(tapPath),
                child: image,
              ),
      ),
    );
  }
}
