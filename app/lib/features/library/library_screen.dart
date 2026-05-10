import 'package:flutter/material.dart';
import 'package:ui_kit/ui_kit.dart';

class LibraryScreen extends StatelessWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(
        child: EmptyState(
          icon: Icons.video_library_outlined,
          title: 'Library',
          message:
              'Tutorial library lands in Phase 1. Imports from device or URL.',
        ),
      ),
    );
  }
}
