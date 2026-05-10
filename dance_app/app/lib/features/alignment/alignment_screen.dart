import 'package:flutter/material.dart';
import 'package:ui_kit/ui_kit.dart';

class AlignmentScreen extends StatelessWidget {
  const AlignmentScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(
        child: EmptyState(
          icon: Icons.center_focus_strong_outlined,
          title: 'Align',
          message:
              'Manual 5-point alignment lands in Phase 3; AI auto-detection in Phase 4.',
        ),
      ),
    );
  }
}
