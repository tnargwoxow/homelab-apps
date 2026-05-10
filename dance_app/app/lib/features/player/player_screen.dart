import 'package:flutter/material.dart';
import 'package:ui_kit/ui_kit.dart';

class PlayerScreen extends StatelessWidget {
  const PlayerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(
        child: EmptyState(
          icon: Icons.play_circle_outline,
          title: 'Player',
          message:
              'media_kit playback, A/B loop, pitch-preserving speed control land in Phase 1.',
        ),
      ),
    );
  }
}
