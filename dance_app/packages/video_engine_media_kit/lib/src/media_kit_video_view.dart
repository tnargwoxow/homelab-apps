import 'package:flutter/material.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:video_engine_api/video_engine_api.dart';

import 'media_kit_video_engine.dart';

/// Renders the video output of a [VideoEngine].
///
/// If [engine] is a [MediaKitVideoEngine] this widget renders the underlying
/// media_kit [Video] widget. For any other implementation (e.g. fakes) it
/// falls back to a placeholder so the UI keeps building.
class MediaKitVideoView extends StatelessWidget {
  const MediaKitVideoView({super.key, required this.engine});

  final VideoEngine engine;

  @override
  Widget build(BuildContext context) {
    final local = engine;
    if (local is MediaKitVideoEngine) {
      return Video(controller: local.videoController);
    }
    return Container(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      alignment: Alignment.center,
      child: const Text('Video unavailable'),
    );
  }
}
