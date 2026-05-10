import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ui_kit/ui_kit.dart';

import 'composition_root.dart';
import 'router.dart';

void main() {
  runApp(
    ProviderScope(
      overrides: buildFakeOverrides(),
      child: const DanceApp(),
    ),
  );
}

class DanceApp extends ConsumerWidget {
  const DanceApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Dance',
      theme: DanceTheme.light(),
      darkTheme: DanceTheme.dark(),
      routerConfig: router,
    );
  }
}
