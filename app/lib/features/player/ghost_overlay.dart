import 'dart:async';

import 'package:flutter/material.dart';
import 'package:metadata_store_api/metadata_store_api.dart';
import 'package:video_engine_api/video_engine_api.dart';
import 'package:video_engine_media_kit/video_engine_media_kit.dart';

/// Ghost playback overlay: renders a recording's video on top of the
/// tutorial, transformed by a saved [AlignmentPreset] so matching points
/// land in the same screen positions.
///
/// The container's logical size is treated as the tutorial's frame; the
/// recording engine's [MediaKitVideoView] is sized to the same box and then
/// affinely transformed so a recording coordinate `(u, v)` ∈ [0,1]² lands
/// at the tutorial coordinate produced by `preset.matrix · (u, v, 1)`.
class GhostOverlay extends StatelessWidget {
  const GhostOverlay({
    super.key,
    required this.engine,
    required this.preset,
    required this.opacity,
  });

  final VideoEngine engine;
  final AlignmentPreset preset;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final w = constraints.maxWidth;
          final h = constraints.maxHeight;
          final m = _matrixFor(preset.matrix, w, h);
          return IgnorePointer(
            child: Opacity(
              opacity: opacity,
              child: Transform(
                transform: m,
                alignment: Alignment.topLeft,
                child: SizedBox(
                  width: w,
                  height: h,
                  child: MediaKitVideoView(engine: engine),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  /// Lifts a 2D affine in normalised image space `(u, v)` ∈ [0,1]² to a 4×4
  /// transform in pixel space `(px, py)` for a widget of size `(W, H)`.
  ///
  /// Normalised: `u' = a·u + b·v + c`, `v' = d·u + e·v + f`.
  /// Pixel: `(u·W, v·H) → (u'·W, v'·H)` =
  ///   `(a·px + (b·W/H)·py + c·W, (d·H/W)·px + e·py + f·H)`.
  static Matrix4 _matrixFor(List<double> m, double w, double h) {
    final a = m[0], b = m[1], c = m[2];
    final d = m[3], e = m[4], f = m[5];
    final ratio = h == 0 ? 1.0 : w / h;
    final invRatio = w == 0 ? 1.0 : h / w;
    final out = Matrix4.identity();
    // Column 0 (multiplies px / x_in)
    out.setEntry(0, 0, a);
    out.setEntry(1, 0, d * invRatio);
    // Column 1 (multiplies py / y_in)
    out.setEntry(0, 1, b * ratio);
    out.setEntry(1, 1, e);
    // Column 3 (translation)
    out.setEntry(0, 3, c * w);
    out.setEntry(1, 3, f * h);
    return out;
  }
}

/// Drives a recording [VideoEngine] in lockstep with a master tutorial
/// engine. The two streams are linked by the saved keyframe offset
///
///     recordingTime = tutorialTime - tutorialKeyframeMs + recordingKeyframeMs
///
/// On every tutorial position tick, if the recording has drifted by more
/// than [driftThreshold], the recording is reseeked. Play/pause are
/// mirrored. Caller owns both engine instances and is responsible for
/// disposing them; this controller only manages subscriptions.
class GhostSyncController {
  GhostSyncController({
    required this.tutorial,
    required this.recording,
    required this.preset,
    this.driftThreshold = const Duration(milliseconds: 80),
  });

  final VideoEngine tutorial;
  final VideoEngine recording;
  final AlignmentPreset preset;
  final Duration driftThreshold;

  StreamSubscription<Duration>? _posSub;
  StreamSubscription<PlaybackState>? _stateSub;
  bool _isPlaying = false;
  bool _seeking = false;
  Duration _lastRecordingPos = Duration.zero;
  StreamSubscription<Duration>? _recPosSub;

  void start() {
    _posSub = tutorial.position.listen(_onTutorialPosition);
    _stateSub = tutorial.state.listen(_onTutorialState);
    _recPosSub = recording.position.listen((p) => _lastRecordingPos = p);
  }

  Future<void> dispose() async {
    await _posSub?.cancel();
    await _stateSub?.cancel();
    await _recPosSub?.cancel();
  }

  Duration _expectedRecording(Duration tutorialPos) {
    final ms = tutorialPos.inMilliseconds -
        preset.tutorialKeyframeMs +
        preset.recordingKeyframeMs;
    return Duration(milliseconds: ms < 0 ? 0 : ms);
  }

  Future<void> _onTutorialPosition(Duration tPos) async {
    if (_seeking) return;
    final expected = _expectedRecording(tPos);
    final drift = (expected - _lastRecordingPos).abs();
    if (drift > driftThreshold) {
      _seeking = true;
      try {
        await recording.seek(expected);
      } finally {
        _seeking = false;
      }
    }
  }

  Future<void> _onTutorialState(PlaybackState s) async {
    final shouldPlay = s == PlaybackState.playing;
    if (shouldPlay == _isPlaying) return;
    _isPlaying = shouldPlay;
    if (shouldPlay) {
      await recording.play();
    } else {
      await recording.pause();
    }
  }
}
