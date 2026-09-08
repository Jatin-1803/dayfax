import 'package:dailyfax/core/theme/app_theme.dart';
import 'package:dailyfax/features/auth/presentation/screens/login_screen.dart';
import 'package:dailyfax/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Login screen renders DayFax branding', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: LoginScreen(),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('DayFax'), findsOneWidget);
    expect(find.text('Continue'), findsOneWidget);
    expect(find.byType(AppButton), findsOneWidget);
  });

  test('themes are split by role', () {
    final customer = AppTheme.forRole(AppRole.customer);
    final delivery = AppTheme.forRole(AppRole.deliveryPartner);

    expect(customer.colorScheme.primary, CustomerColors.primary);
    expect(customer.scaffoldBackgroundColor, CustomerColors.background);
    expect(delivery.scaffoldBackgroundColor, isNot(CustomerColors.background));
  });
}
