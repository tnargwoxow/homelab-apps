import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ui_kit/ui_kit.dart';

void main() {
  testWidgets('TimelineScrubber renders without error', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TimelineScrubber(
            position: const Duration(seconds: 12, milliseconds: 345),
            duration:
                const Duration(minutes: 1, seconds: 23, milliseconds: 456),
            onSeek: (Duration _) {},
          ),
        ),
      ),
    );

    expect(find.byType(TimelineScrubber), findsOneWidget);
    expect(find.textContaining('0:12.345'), findsOneWidget);
    expect(find.textContaining('1:23.456'), findsOneWidget);
  });

  testWidgets('TimelineScrubber tap invokes onSeek', (
    WidgetTester tester,
  ) async {
    Duration? seeked;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 400,
            child: TimelineScrubber(
              position: Duration.zero,
              duration: const Duration(seconds: 10),
              onSeek: (Duration d) => seeked = d,
            ),
          ),
        ),
      ),
    );

    final gesture = find.byType(GestureDetector).first;
    await tester.tap(gesture);
    await tester.pump();

    expect(seeked, isNotNull);
  });

  testWidgets('TimelineScrubber A/B buttons appear when callbacks set', (
    WidgetTester tester,
  ) async {
    Duration? aSet;
    Duration? bSet;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TimelineScrubber(
            position: const Duration(seconds: 3),
            duration: const Duration(seconds: 10),
            onSeek: (Duration _) {},
            onSetLoopStart: (Duration d) => aSet = d,
            onSetLoopEnd: (Duration d) => bSet = d,
          ),
        ),
      ),
    );

    expect(find.text('A'), findsOneWidget);
    expect(find.text('B'), findsOneWidget);

    await tester.tap(find.text('A'));
    await tester.tap(find.text('B'));
    await tester.pump();

    expect(aSet, const Duration(seconds: 3));
    expect(bSet, const Duration(seconds: 3));
  });
}
