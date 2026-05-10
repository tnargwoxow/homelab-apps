import 'package:dance_app/composition_root.dart';
import 'package:dance_app/main.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('App boots and renders the Library tab', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: buildFakeOverrides(),
        child: const DanceApp(),
      ),
    );
    await tester.pumpAndSettle();
    // Bottom nav has a Library destination; the empty-state title is "Library" too.
    expect(find.text('Library'), findsWidgets);
  });
}
