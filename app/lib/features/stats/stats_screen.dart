import 'package:flutter/material.dart';
import 'package:ui_kit/ui_kit.dart';

class StatsScreen extends StatelessWidget {
  const StatsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(
        child: EmptyState(
          icon: Icons.bar_chart_outlined,
          title: 'Stats',
          message: 'Practice time, sessions, recordings, charts land in Phase 5.',
        ),
      ),
    );
  }
}
