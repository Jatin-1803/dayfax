import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'customer_colors.dart';
import 'customer_radius.dart';

export 'customer_colors.dart';
export 'customer_radius.dart';
export 'customer_shadows.dart';
export 'customer_spacing.dart';

/// Customer ThemeData — Soft Minimalism / Premium Lifestyle
abstract final class CustomerTheme {
  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: const ColorScheme.light(
        primary: CustomerColors.primary,
        onPrimary: CustomerColors.onPrimary,
        primaryContainer: CustomerColors.primaryContainer,
        onPrimaryContainer: CustomerColors.onPrimaryContainer,
        secondary: CustomerColors.secondary,
        onSecondary: CustomerColors.onSecondary,
        secondaryContainer: CustomerColors.secondaryContainer,
        onSecondaryContainer: CustomerColors.onSecondaryContainer,
        tertiary: CustomerColors.tertiary,
        onTertiary: CustomerColors.onTertiary,
        error: CustomerColors.error,
        onError: CustomerColors.onError,
        surface: CustomerColors.surface,
        onSurface: CustomerColors.onSurface,
        onSurfaceVariant: CustomerColors.onSurfaceVariant,
        outline: CustomerColors.outline,
        outlineVariant: CustomerColors.outlineVariant,
      ),
      scaffoldBackgroundColor: CustomerColors.background,
    );

    final textTheme = GoogleFonts.plusJakartaSansTextTheme(base.textTheme).copyWith(
      displayLarge: GoogleFonts.plusJakartaSans(
        fontSize: 32,
        fontWeight: FontWeight.w800,
        height: 40 / 32,
        letterSpacing: -0.64,
        color: CustomerColors.onSurface,
      ),
      headlineLarge: GoogleFonts.plusJakartaSans(
        fontSize: 24,
        fontWeight: FontWeight.w700,
        height: 32 / 24,
        letterSpacing: -0.24,
        color: CustomerColors.onSurface,
      ),
      headlineMedium: GoogleFonts.plusJakartaSans(
        fontSize: 22,
        fontWeight: FontWeight.w700,
        height: 28 / 22,
        color: CustomerColors.onSurface,
      ),
      headlineSmall: GoogleFonts.plusJakartaSans(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        height: 28 / 20,
        color: CustomerColors.onSurface,
      ),
      titleMedium: GoogleFonts.plusJakartaSans(
        fontSize: 16,
        fontWeight: FontWeight.w500,
        height: 24 / 16,
        color: CustomerColors.onSurface,
      ),
      bodyLarge: GoogleFonts.plusJakartaSans(
        fontSize: 16,
        fontWeight: FontWeight.w500,
        height: 24 / 16,
        color: CustomerColors.onSurface,
      ),
      bodyMedium: GoogleFonts.plusJakartaSans(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        height: 20 / 14,
        color: CustomerColors.onSurface,
      ),
      labelLarge: GoogleFonts.plusJakartaSans(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        height: 20 / 14,
        letterSpacing: 0.14,
        color: CustomerColors.onSurface,
      ),
      labelSmall: GoogleFonts.plusJakartaSans(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        height: 16 / 12,
        letterSpacing: 0.24,
        color: CustomerColors.onSurfaceVariant,
      ),
    );

    return base.copyWith(
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: CustomerColors.surface,
        foregroundColor: CustomerColors.onSurface,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: textTheme.headlineSmall?.copyWith(color: CustomerColors.primary),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: CustomerColors.primary,
          foregroundColor: CustomerColors.onPrimary,
          minimumSize: const Size.fromHeight(56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(CustomerRadius.full),
          ),
          textStyle: textTheme.labelLarge?.copyWith(
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
          elevation: 0,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: CustomerColors.inputFill,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(CustomerRadius.full),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(CustomerRadius.full),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(CustomerRadius.full),
          borderSide: const BorderSide(color: CustomerColors.primaryContainer, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
    );
  }
}
