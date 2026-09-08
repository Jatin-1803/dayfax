import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_radius.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/app_search_bar.dart';
import '../../../../shared/widgets/eta_banner.dart';
import '../../../../shared/widgets/product_card.dart';
import '../../../../shared/widgets/state_widgets.dart';
import '../../../../shared/widgets/sticky_cart_bar.dart';
import '../../../addresses/data/location_service.dart';
import '../../../banners/presentation/banners_view_model.dart';
import '../../../banners/presentation/widgets/home_top_banner.dart';
import '../../../addresses/domain/address_models.dart';
import '../../../addresses/presentation/addresses_view_model.dart';
import '../../../addresses/presentation/widgets/address_form_sheet.dart';
import '../../../cart/presentation/widgets/cart_aware_product_card.dart';
import '../../../catalog/domain/catalog_models.dart';
import '../../../catalog/presentation/catalog_view_models.dart';
import '../../../catalog/presentation/widgets/category_icon.dart';
import '../../../catalog/presentation/widgets/category_tile.dart';
import '../../../notifications/presentation/notifications_view_model.dart';
import '../../../orders/domain/delivery_quote.dart';
import '../../../orders/domain/order_models.dart';
import '../../../orders/presentation/orders_view_models.dart';
import '../../../shops/domain/shop_models.dart';
import '../../../shops/presentation/shops_view_models.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalogState = ref.watch(homeCatalogViewModelProvider);
    final addressesAsync = ref.watch(addressesViewModelProvider);
    final quoteAsync = ref.watch(deliveryQuoteProvider(null));
    final recentOrders = ref.watch(ordersListViewModelProvider);
    final selected = addressesAsync.maybeWhen(
      data: (addresses) {
        if (addresses.isEmpty) return null;
        return addresses.firstWhere(
          (a) => a.isDefault,
          orElse: () => addresses.first,
        );
      },
      orElse: () => null,
    );

    final locationTitle = selected?.label ?? ref.t('home.set_location');
    final locationSubtitle = selected?.shortDisplay ?? ref.t('home.choose_address');
    final etaMinutes = quoteAsync.maybeWhen(
      data: (q) => q.etaMinutes,
      orElse: () => null,
    );

    return Scaffold(
      appBar: AppBar(
        titleSpacing: CustomerSpacing.marginMobile,
        title: InkWell(
          onTap: () => _openLocationPicker(context, ref),
          borderRadius: BorderRadius.circular(CustomerRadius.sm),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    ref.t('home.delivery_in'),
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                  EtaBanner(
                    etaMinutes: etaMinutes ?? 0,
                    compact: true,
                    message: etaMinutes == null ? '…' : null,
                  ),
                ],
              ),
              Row(
                children: [
                  Flexible(
                    child: Text(
                      locationTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ),
                  const Icon(Icons.expand_more, size: 18),
                ],
              ),
              if (selected != null)
                Text(
                  locationSubtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: CustomerColors.onSurfaceVariant,
                      ),
                ),
            ],
          ),
        ),
        leading: Padding(
          padding: const EdgeInsets.only(left: CustomerSpacing.md),
          child: IconButton(
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            onPressed: () => _openLocationPicker(context, ref),
            icon: const Icon(Icons.location_on, color: CustomerColors.primary),
          ),
        ),
        leadingWidth: 40,
        actions: [
          IconButton(
            onPressed: () => context.push('/notifications'),
            icon: Badge(
              isLabelVisible: ref.watch(notificationsUnreadCountProvider) > 0,
              smallSize: 8,
              child: const Icon(Icons.notifications_outlined),
            ),
          ),
        ],
      ),
      body: StickyCartScaffoldBody(
        child: switch (catalogState) {
          CatalogLoading() => const Padding(
              padding: EdgeInsets.all(CustomerSpacing.marginMobile),
              child: _HomeSkeleton(),
            ),
          CatalogError(:final message) => ErrorState(
              message: message,
              onRetry: () => ref.read(homeCatalogViewModelProvider.notifier).load(),
            ),
          CatalogReady(
            :final categories,
            :final popular,
            :final grocery,
            :final vegetables,
            :final cosmetics,
          ) =>
            RefreshIndicator(
              color: CustomerColors.primary,
              onRefresh: () async {
                await Future.wait([
                  ref.read(homeCatalogViewModelProvider.notifier).load(),
                  ref.read(homeBannersViewModelProvider.notifier).load(),
                  ref.read(popularShopsViewModelProvider.notifier).load(),
                  ref.read(addressesViewModelProvider.notifier).load(),
                  ref.refresh(deliveryQuoteProvider(null).future),
                  ref.read(ordersListViewModelProvider.notifier).load(reset: true),
                ]);
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  CustomerSpacing.marginMobile,
                  CustomerSpacing.lg,
                  CustomerSpacing.marginMobile,
                  100,
                ),
                children: [
                  AppSearchBar(
                    readOnly: true,
                    onTap: () => context.push('/search'),
                  ),
                  if (etaMinutes != null && etaMinutes > 0) ...[
                    const SizedBox(height: CustomerSpacing.md),
                    EtaBanner(etaMinutes: etaMinutes),
                  ],
                  const HomeTopBanner(),
                  const SizedBox(height: CustomerSpacing.lg),
                  if (categories.isNotEmpty) ...[
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            ref.t('home.shop_by_category'),
                            style: Theme.of(context).textTheme.headlineSmall,
                          ),
                        ),
                        TextButton(
                          onPressed: () => context.go('/categories'),
                          child: Text(context.t('common.see_all')),
                        ),
                      ],
                    ),
                    const SizedBox(height: CustomerSpacing.sm),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: categories.length.clamp(0, 8),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 4,
                        mainAxisSpacing: CustomerSpacing.sm,
                        crossAxisSpacing: CustomerSpacing.sm,
                        childAspectRatio: 0.78 /
                            MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 1.35),
                      ),
                      itemBuilder: (context, index) {
                        final category = categories[index];
                        return CategoryTile(
                          label: category.name,
                          iconKey: category.iconKey,
                          imageUrl: category.imageUrl,
                          color: chipColorForIndex(index),
                          compact: true,
                          onTap: () => context.push('/category/${category.slug}'),
                        );
                      },
                    ),
                  ],
                  const _PopularShopsRail(),
                  if (recentOrders.items.isNotEmpty)
                    _ReorderRail(orders: recentOrders.items.take(5).toList()),
                  _ProductRail(
                    title: ref.t('home.popular_near_you'),
                    products: popular,
                    onSeeAll: () => context.go('/categories'),
                  ),
                  _ProductRail(
                    title: ref.t('home.rail_grocery'),
                    products: grocery,
                    onSeeAll: () => context.push('/category/grocery'),
                  ),
                  _ProductRail(
                    title: ref.t('home.rail_vegetables'),
                    products: vegetables,
                    onSeeAll: () => context.push('/category/vegetables'),
                  ),
                  _ProductRail(
                    title: ref.t('home.rail_cosmetics'),
                    products: cosmetics,
                    onSeeAll: () => context.push('/category/cosmetics'),
                  ),
                ],
              ),
            ),
        },
      ),
    );
  }
}

class _HomeSkeleton extends StatelessWidget {
  const _HomeSkeleton();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SkeletonBox(height: 48, borderRadius: 999),
        const SizedBox(height: CustomerSpacing.lg),
        const SkeletonBox(height: 56, borderRadius: 16),
        const SizedBox(height: CustomerSpacing.lg),
        ProductCardRail(
          itemCount: 4,
          padding: EdgeInsets.zero,
          itemBuilder: (_, _) => const ProductCardSkeleton(),
        ),
      ],
    );
  }
}

class _PopularShopsRail extends ConsumerWidget {
  const _PopularShopsRail();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(popularShopsViewModelProvider);
    if (state.isLoading && state.shops.isEmpty) {
      return const Padding(
        padding: EdgeInsets.only(top: CustomerSpacing.lg),
        child: SizedBox(
          height: 108,
          child: SkeletonBox(height: 108, borderRadius: 16),
        ),
      );
    }
    if (state.shops.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: CustomerSpacing.lg),
        Row(
          children: [
            Expanded(
              child: Text(
                ref.t('home.popular_local_shops'),
                style: Theme.of(context).textTheme.headlineSmall,
              ),
            ),
            TextButton(
              onPressed: () => context.push('/shops'),
              child: Text(context.t('common.see_all')),
            ),
          ],
        ),
        const SizedBox(height: CustomerSpacing.sm),
        SizedBox(
          height: 112,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: state.shops.length,
            separatorBuilder: (_, _) => const SizedBox(width: CustomerSpacing.md),
            itemBuilder: (context, index) {
              final shop = state.shops[index];
              return _ShopAvatarTile(shop: shop);
            },
          ),
        ),
      ],
    );
  }
}

class _ShopAvatarTile extends StatelessWidget {
  const _ShopAvatarTile({required this.shop});

  final ShopSummary shop;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.push('/shops/${shop.slug}'),
      borderRadius: BorderRadius.circular(CustomerRadius.md),
      child: SizedBox(
        width: 84,
        child: Column(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(CustomerRadius.full),
              child: shop.imageUrl == null || shop.imageUrl!.isEmpty
                  ? Container(
                      width: 64,
                      height: 64,
                      color: CustomerColors.primaryContainer,
                      child: const Icon(Icons.storefront, color: CustomerColors.primary),
                    )
                  : CachedNetworkImage(
                      imageUrl: shop.imageUrl!,
                      width: 64,
                      height: 64,
                      fit: BoxFit.cover,
                      memCacheWidth: 128,
                      errorWidget: (_, _, _) => Container(
                        width: 64,
                        height: 64,
                        color: CustomerColors.primaryContainer,
                        child: const Icon(Icons.storefront, color: CustomerColors.primary),
                      ),
                    ),
            ),
            const SizedBox(height: CustomerSpacing.sm),
            Text(
              shop.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.labelMedium,
            ),
          ],
        ),
      ),
    );
  }
}

class _ReorderRail extends StatelessWidget {
  const _ReorderRail({required this.orders});

  final List<CustomerOrder> orders;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: CustomerSpacing.lg),
        Row(
          children: [
            Expanded(
              child: Text(context.t('home.order_again'), style: Theme.of(context).textTheme.headlineSmall),
            ),
            TextButton(
              onPressed: () => context.go('/orders'),
              child: Text(context.t('common.see_all')),
            ),
          ],
        ),
        const SizedBox(height: CustomerSpacing.sm),
        SizedBox(
          height: 88,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: orders.length,
            separatorBuilder: (_, _) => const SizedBox(width: CustomerSpacing.md),
            itemBuilder: (context, index) {
              final order = orders[index];
              return Material(
                color: CustomerColors.surfaceContainerLowest,
                borderRadius: BorderRadius.circular(CustomerRadius.md),
                child: InkWell(
                  onTap: () => context.push('/orders/${order.id}'),
                  borderRadius: BorderRadius.circular(CustomerRadius.md),
                  child: Container(
                    width: 200,
                    padding: const EdgeInsets.all(CustomerSpacing.md),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          order.orderNumber,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.labelLarge,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          order.status,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: CustomerColors.onSurfaceVariant,
                              ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

Future<void> _openLocationPicker(BuildContext pageContext, WidgetRef ref) async {
  await showModalBottomSheet<void>(
    context: pageContext,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) {
      return Consumer(
        builder: (sheetBodyContext, ref, _) {
          final asyncAddresses = ref.watch(addressesViewModelProvider);
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                CustomerSpacing.marginMobile,
                0,
                CustomerSpacing.marginMobile,
                CustomerSpacing.lg,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    ref.t('home.select_delivery_location'),
                    style: Theme.of(sheetBodyContext).textTheme.titleLarge,
                  ),
                  const SizedBox(height: CustomerSpacing.md),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.my_location, color: CustomerColors.primary),
                    title: Text(ref.t('home.use_current_location')),
                    subtitle: Text(ref.t('home.detect_gps')),
                    onTap: () async {
                      // Pop sheet first, then use the HOME page context.
                      // Using the sheet BuildContext here orphaned the loader dialog
                      // and made GPS appear stuck forever.
                      Navigator.pop(sheetContext);
                      await Future<void>.delayed(const Duration(milliseconds: 50));
                      if (!pageContext.mounted) return;
                      await _useCurrentLocationFlow(pageContext, ref);
                    },
                  ),
                  const Divider(),
                  asyncAddresses.when(
                    skipLoadingOnReload: true,
                    skipLoadingOnRefresh: true,
                    loading: () => Padding(
                      padding: const EdgeInsets.symmetric(vertical: CustomerSpacing.md),
                      child: Column(
                        children: List.generate(
                          3,
                          (_) => const Padding(
                            padding: EdgeInsets.only(bottom: CustomerSpacing.sm),
                            child: ListCardSkeleton(height: 64, borderRadius: CustomerRadius.md),
                          ),
                        ),
                      ),
                    ),
                    error: (error, _) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: CustomerSpacing.md),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            error is AppFailure
                                ? ref.t(error.message)
                                : ref.t('home.could_not_load_addresses'),
                            style: const TextStyle(color: CustomerColors.error),
                          ),
                          TextButton(
                            onPressed: () =>
                                ref.read(addressesViewModelProvider.notifier).load(),
                            child: Text(ref.t('common.retry')),
                          ),
                        ],
                      ),
                    ),
                    data: (addresses) {
                      if (addresses.isEmpty) {
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: CustomerSpacing.md),
                          child: Text(ref.t('home.no_saved_addresses')),
                        );
                      }
                      return ConstrainedBox(
                        constraints: BoxConstraints(
                          maxHeight: MediaQuery.sizeOf(sheetBodyContext).height * 0.4,
                        ),
                        child: ListView.separated(
                          shrinkWrap: true,
                          itemCount: addresses.length,
                          separatorBuilder: (_, _) => const Divider(height: 1),
                          itemBuilder: (context, index) {
                            final address = addresses[index];
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: Icon(
                                address.isDefault
                                    ? Icons.check_circle
                                    : Icons.location_on_outlined,
                                color: address.isDefault
                                    ? CustomerColors.primary
                                    : CustomerColors.onSurfaceVariant,
                              ),
                              title: Text(
                                address.fullName?.trim().isNotEmpty == true
                                    ? '${address.label} · ${address.fullName}'
                                    : address.label,
                              ),
                              subtitle: Text(address.summaryLine),
                              onTap: () async {
                                Navigator.pop(sheetContext);
                                if (!address.isDefault) {
                                  await ref
                                      .read(addressesViewModelProvider.notifier)
                                      .makeDefault(address.id);
                                }
                                ref.invalidate(deliveryQuoteProvider(null));
                              },
                            );
                          },
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: CustomerSpacing.md),
                  OutlinedButton.icon(
                    onPressed: () async {
                      Navigator.pop(sheetContext);
                      await Future<void>.delayed(const Duration(milliseconds: 50));
                      if (!pageContext.mounted) return;
                      await showAddressFormSheet(pageContext);
                    },
                    icon: const Icon(Icons.add),
                    label: Text(ref.t('home.add_new_address')),
                  ),
                  TextButton(
                    onPressed: () {
                      Navigator.pop(sheetContext);
                      pageContext.push('/addresses');
                    },
                    child: Text(ref.t('home.manage_addresses')),
                  ),
                ],
              ),
            ),
          );
        },
      );
    },
  );
}

Future<void> _useCurrentLocationFlow(BuildContext context, WidgetRef ref) async {
  final locationService = ref.read(locationServiceProvider);
  final messenger = ScaffoldMessenger.of(context);
  final navigator = Navigator.of(context, rootNavigator: true);

  try {
    await locationService.ensureReady();
  } on AppFailure catch (failure) {
    if (!context.mounted) return;
    messenger.showSnackBar(SnackBar(content: Text(ref.tr(failure.message))));
    return;
  } catch (_) {
    if (!context.mounted) return;
    messenger.showSnackBar(
      SnackBar(content: Text(ref.tr('home.location_permission_failed'))),
    );
    return;
  }

  if (!context.mounted) return;

  var dialogOpen = true;
  unawaited(
    showDialog<void>(
      context: context,
      useRootNavigator: true,
      barrierDismissible: false,
      builder: (dialogContext) {
        return AlertDialog(
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(),
              const SizedBox(height: CustomerSpacing.md),
              Text(dialogContext.t('home.getting_location')),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                dialogOpen = false;
                Navigator.of(dialogContext).pop();
              },
              child: Text(dialogContext.t('common.cancel')),
            ),
          ],
        );
      },
    ).whenComplete(() => dialogOpen = false),
  );

  void closeDialog() {
    if (!dialogOpen) return;
    dialogOpen = false;
    if (navigator.canPop()) {
      navigator.pop();
    }
  }

  try {
    final resolved = await locationService.resolveCurrentLocation(
      requestPermission: false,
    );
    if (!context.mounted) return;
    closeDialog();
    final draft = AddressDraft(
      label: 'Home',
      line1: resolved.line1,
      line2: resolved.line2,
      city: resolved.city,
      state: resolved.state,
      pincode: resolved.pincode,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      isDefault: true,
    );
    await showAddressFormSheet(context, prefill: draft);
  } on AppFailure catch (failure) {
    if (!context.mounted) return;
    closeDialog();
    messenger.showSnackBar(
      SnackBar(
        content: Text(ref.tr(failure.message)),
        action: SnackBarAction(
          label: ref.tr('home.add_manually'),
          onPressed: () => showAddressFormSheet(context),
        ),
      ),
    );
  } catch (error) {
    if (!context.mounted) return;
    closeDialog();
    messenger.showSnackBar(
      SnackBar(
        content: Text(ref.tr('home.location_timed_out')),
        action: SnackBarAction(
          label: ref.tr('home.add_manually'),
          onPressed: () => showAddressFormSheet(context),
        ),
      ),
    );
  }
}

class _ProductRail extends StatelessWidget {
  const _ProductRail({
    required this.title,
    required this.products,
    required this.onSeeAll,
  });

  final String title;
  final List<CatalogProduct> products;
  final VoidCallback onSeeAll;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: CustomerSpacing.md),
        Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ),
            TextButton(onPressed: onSeeAll, child: Text(context.t('common.see_all'))),
          ],
        ),
        const SizedBox(height: CustomerSpacing.sm),
        ProductCardRail(
          itemCount: products.length,
          padding: EdgeInsets.zero,
          itemBuilder: (context, index) {
            return CartAwareProductCard(product: products[index]);
          },
        ),
      ],
    );
  }
}

