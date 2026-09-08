import 'package:flutter/material.dart';

import '../../core/i18n/i18n_providers.dart';
import '../../core/theme/customer/customer_colors.dart';
import '../../core/theme/customer/customer_radius.dart';
import '../../core/theme/customer/customer_spacing.dart';
import 'app_button.dart';

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    required this.message,
    this.icon = Icons.inbox_outlined,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(CustomerSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 56, color: CustomerColors.outline),
            const SizedBox(height: CustomerSpacing.md),
            Text(title, style: Theme.of(context).textTheme.headlineSmall, textAlign: TextAlign.center),
            const SizedBox(height: CustomerSpacing.sm),
            Text(
              message,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: CustomerColors.onSurfaceVariant,
                  ),
              textAlign: TextAlign.center,
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: CustomerSpacing.lg),
              AppButton(label: actionLabel!, onPressed: onAction),
            ],
          ],
        ),
      ),
    );
  }
}

class ErrorState extends StatelessWidget {
  const ErrorState({
    super.key,
    required this.message,
    required this.onRetry,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      title: context.t('common.something_went_wrong'),
      message: context.t(message),
      icon: Icons.error_outline,
      actionLabel: context.t('common.retry'),
      onAction: onRetry,
    );
  }
}

class LoadingState extends StatelessWidget {
  const LoadingState({super.key, this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(color: CustomerColors.primary),
          if (message != null) ...[
            const SizedBox(height: CustomerSpacing.md),
            Text(message!, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ],
      ),
    );
  }
}

class SkeletonBox extends StatefulWidget {
  const SkeletonBox({
    super.key,
    this.width,
    this.height = 16,
    this.borderRadius = 8,
  });

  final double? width;
  final double height;
  final double borderRadius;

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = _controller.value;
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            color: Color.lerp(
              CustomerColors.surfaceContainer,
              CustomerColors.surfaceContainerHigh,
              t,
            ),
            borderRadius: BorderRadius.circular(widget.borderRadius),
          ),
        );
      },
    );
  }
}

class ProductCardSkeleton extends StatelessWidget {
  const ProductCardSkeleton({super.key, this.width = 124});

  final double width;

  @override
  Widget build(BuildContext context) {
    final resolvedWidth = width.isFinite ? width : null;
    final imageHeight = width.isFinite ? width : 120.0;

    return Container(
      width: resolvedWidth,
      decoration: BoxDecoration(
        color: CustomerColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(CustomerRadius.md),
        border: Border.all(color: CustomerColors.outlineVariant.withValues(alpha: 0.28)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          SkeletonBox(width: resolvedWidth, height: imageHeight, borderRadius: 0),
          const Padding(
            padding: EdgeInsets.fromLTRB(6, 6, 6, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(width: 96, height: 12),
                SizedBox(height: 2),
                SkeletonBox(width: 56, height: 10),
                SizedBox(height: CustomerSpacing.xs),
                SkeletonBox(width: 48, height: 13),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ListCardSkeleton extends StatelessWidget {
  const ListCardSkeleton({
    super.key,
    this.height = 96,
    this.borderRadius = CustomerRadius.lg,
  });

  final double height;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    return SkeletonBox(height: height, borderRadius: borderRadius);
  }
}

class ProductDetailSkeleton extends StatelessWidget {
  const ProductDetailSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        CustomerSpacing.marginMobile,
        CustomerSpacing.md,
        CustomerSpacing.marginMobile,
        CustomerSpacing.lg,
      ),
      children: const [
        SkeletonBox(height: 48, borderRadius: CustomerRadius.md),
        SizedBox(height: CustomerSpacing.md),
        SkeletonBox(height: 280, borderRadius: CustomerRadius.lg),
        SizedBox(height: CustomerSpacing.lg),
        SkeletonBox(width: 220, height: 22),
        SizedBox(height: CustomerSpacing.sm),
        SkeletonBox(width: 120, height: 14),
        SizedBox(height: CustomerSpacing.md),
        SkeletonBox(width: 96, height: 28),
        SizedBox(height: CustomerSpacing.lg),
        SkeletonBox(height: 48, borderRadius: CustomerRadius.md),
        SizedBox(height: CustomerSpacing.lg),
        SkeletonBox(height: 14),
        SizedBox(height: CustomerSpacing.sm),
        SkeletonBox(height: 14),
        SizedBox(height: CustomerSpacing.sm),
        SkeletonBox(width: 180, height: 14),
        SizedBox(height: CustomerSpacing.xl),
        SkeletonBox(height: 52, borderRadius: CustomerRadius.md),
      ],
    );
  }
}

class OrderDetailSkeleton extends StatelessWidget {
  const OrderDetailSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
      children: [
        const SkeletonBox(width: 120, height: 28, borderRadius: CustomerRadius.full),
        const SizedBox(height: CustomerSpacing.md),
        const SkeletonBox(width: 180, height: 18),
        const SizedBox(height: CustomerSpacing.sm),
        const SkeletonBox(width: 140, height: 14),
        const SizedBox(height: CustomerSpacing.lg),
        ...List.generate(
          3,
          (_) => const Padding(
            padding: EdgeInsets.only(bottom: CustomerSpacing.md),
            child: ListCardSkeleton(height: 72),
          ),
        ),
        const SizedBox(height: CustomerSpacing.sm),
        const SkeletonBox(height: 120, borderRadius: CustomerRadius.lg),
        const SizedBox(height: CustomerSpacing.lg),
        const SkeletonBox(height: 52, borderRadius: CustomerRadius.md),
      ],
    );
  }
}

class CheckoutSkeleton extends StatelessWidget {
  const CheckoutSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
      children: [
        const SkeletonBox(height: 88, borderRadius: CustomerRadius.lg),
        const SizedBox(height: CustomerSpacing.lg),
        ...List.generate(
          3,
          (_) => const Padding(
            padding: EdgeInsets.only(bottom: CustomerSpacing.md),
            child: ListCardSkeleton(height: 80),
          ),
        ),
        const SizedBox(height: CustomerSpacing.sm),
        const SkeletonBox(height: 140, borderRadius: CustomerRadius.lg),
        const SizedBox(height: CustomerSpacing.lg),
        const SkeletonBox(height: 52, borderRadius: CustomerRadius.md),
      ],
    );
  }
}
