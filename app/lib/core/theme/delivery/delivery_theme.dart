import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'delivery_colors.dart';
import 'delivery_radius.dart';

export 'delivery_colors.dart';
export 'delivery_radius.dart';
export 'delivery_shadows.dart';
export 'delivery_spacing.dart';

/// Delivery ThemeData — Modern Corporate / Utility (logistics)
abstract final class DeliveryTheme {
  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: const ColorScheme.light(
        primary: DeliveryColors.primary,
        onPrimary: DeliveryColors.onPrimary,
        primaryContainer: DeliveryColors.primaryContainer,
        onPrimaryContainer: DeliveryColors.onPrimaryContainer,
        secondary: DeliveryColors.secondary,
        onSecondary: DeliveryColors.onSecondary,
        secondaryContainer: DeliveryColors.secondaryContainer,
        onSecondaryContainer: DeliveryColors.onSecondaryContainer,
        tertiary: DeliveryColors.tertiary,
        onTertiary: DeliveryColors.onTertiary,
        error: DeliveryColors.error,
        onError: DeliveryColors.onError,
        surface: DeliveryColors.surface,
        onSurface: DeliveryColors.onSurface,
        onSurfaceVariant: DeliveryColors.onSurfaceVariant,
        outline: DeliveryColors.outline,
        outlineVariant: DeliveryColors.outlineVariant,
      ),
      scaffoldBackgroundColor: DeliveryColors.background,
    );

    final textTheme = GoogleFonts.plusJakartaSansTextTheme(base.textTheme).copyWith(
      headlineLarge: GoogleFonts.plusJakartaSans(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        height: 36 / 28,
        letterSpacing: -0.56,
        color: DeliveryColors.deepSlate,
      ),
      headlineMedium: GoogleFonts.plusJakartaSans(
        fontSize: 22,
        fontWeight: FontWeight.w700,
        height: 28 / 22,
        letterSpacing: -0.22,
        color: DeliveryColors.deepSlate,
      ),
      headlineSmall: GoogleFonts.plusJakartaSans(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        height: 24 / 18,
        color: DeliveryColors.deepSlate,
      ),
      bodyLarge: GoogleFonts.plusJakartaSans(
        fontSize: 18,
        fontWeight: FontWeight.w400,
        height: 26 / 18,
        color: DeliveryColors.onSurface,
      ),
      bodyMedium: GoogleFonts.plusJakartaSans(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        height: 24 / 16,
        color: DeliveryColors.onSurface,
      ),
      labelLarge: GoogleFonts.plusJakartaSans(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        height: 20 / 14,
        letterSpacing: 0.28,
        color: DeliveryColors.onSurface,
      ),
      labelMedium: GoogleFonts.plusJakartaSans(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        height: 16 / 12,
        letterSpacing: 0.6,
        color: DeliveryColors.onSurfaceVariant,
      ),
    );

    return base.copyWith(
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: DeliveryColors.surfaceContainerLowest,
        foregroundColor: DeliveryColors.deepSlate,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: textTheme.headlineSmall,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: DeliveryColors.primary,
          foregroundColor: DeliveryColors.onPrimary,
          minimumSize: const Size.fromHeight(56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(DeliveryRadius.md),
          ),
          textStyle: textTheme.headlineSmall?.copyWith(color: DeliveryColors.onPrimary),
          elevation: 0,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: DeliveryColors.inputFill,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(DeliveryRadius.md),
          borderSide: const BorderSide(color: DeliveryColors.cardBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(DeliveryRadius.md),
          borderSide: const BorderSide(color: DeliveryColors.cardBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(DeliveryRadius.md),
          borderSide: const BorderSide(color: DeliveryColors.primary, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      ),
      cardTheme: CardThemeData(
        color: DeliveryColors.surfaceContainerLowest,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(DeliveryRadius.lg),
          side: const BorderSide(color: DeliveryColors.cardBorder),
        ),
      ),
    );
  }
}
