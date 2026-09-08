import 'package:flutter/material.dart';

/// Horizontal DayFax wordmark. Height is the visual size; width follows the artwork.
class DayfaxLogo extends StatelessWidget {
  const DayfaxLogo({
    super.key,
    this.height = 56,
    this.semanticLabel,
  });

  final double height;
  final String? semanticLabel;

  static const assetPath = 'assets/branding/dayfax_logo.png';

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      assetPath,
      height: height,
      fit: BoxFit.contain,
      semanticLabel: semanticLabel,
      filterQuality: FilterQuality.high,
    );
  }
}
