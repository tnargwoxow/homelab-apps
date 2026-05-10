import 'package:flutter/material.dart';
import 'package:ui_kit/ui_kit.dart';

class PracticeScreen extends StatelessWidget {
  const PracticeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(
        child: EmptyState(
          icon: Icons.videocam_outlined,
          title: 'Practice',
          message: 'Live camera overlay over tutorial video lands in Phase 2.',
        ),
      ),
    );
  }
}
