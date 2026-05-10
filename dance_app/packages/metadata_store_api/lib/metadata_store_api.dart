/// Public interface for the metadata store: tutorials, recordings sessions,
/// loop markers, alignment presets, pose keyframes, user settings.
library metadata_store_api;

import 'package:core_api/core_api.dart';
import 'package:meta/meta.dart';

@immutable
class LoopMarker {
  const LoopMarker({
    required this.id,
    required this.tutorialId,
    required this.label,
    required this.start,
    required this.end,
  });
  final String id;
  final TutorialId tutorialId;
  final String label;
  final Duration start;
  final Duration end;
}

enum SessionMode { playback, liveOverlay, ghost }

@immutable
class PracticeSession {
  const PracticeSession({
    required this.id,
    required this.tutorialId,
    required this.startedAt,
    required this.endedAt,
    required this.totalActive,
    required this.mode,
    required this.loopCount,
    required this.avgSpeed,
    this.recordingId,
  });

  final SessionId id;
  final TutorialId tutorialId;
  final DateTime startedAt;
  final DateTime endedAt;
  final Duration totalActive;
  final SessionMode mode;
  final int loopCount;
  final double avgSpeed;
  final RecordingId? recordingId;
}

@immutable
class AlignmentPreset {
  const AlignmentPreset({
    required this.id,
    required this.recordingId,
    required this.tutorialId,
    required this.tutorialKeyframeMs,
    required this.recordingKeyframeMs,
    required this.matrix,
    required this.isAi,
    required this.createdAt,
  });

  final String id;
  final RecordingId recordingId;
  final TutorialId tutorialId;
  final int tutorialKeyframeMs;
  final int recordingKeyframeMs;

  /// Row-major 3x3 affine matrix.
  final List<double> matrix;
  final bool isAi;
  final DateTime createdAt;
}

@immutable
class UserSettings {
  const UserSettings({
    required this.defaultPlaybackRate,
    required this.mirrorCameraOverlay,
    required this.overlayOpacity,
  });

  final double defaultPlaybackRate;
  final bool mirrorCameraOverlay;
  final double overlayOpacity;

  static const UserSettings defaults = UserSettings(
    defaultPlaybackRate: 1.0,
    mirrorCameraOverlay: true,
    overlayOpacity: 0.5,
  );
}

abstract interface class MetadataStore {
  Future<void> upsertLoopMarker(LoopMarker marker);
  Future<List<LoopMarker>> loopMarkersFor(TutorialId tutorialId);
  Future<void> deleteLoopMarker(String id);

  Future<void> recordSession(PracticeSession session);
  Future<List<PracticeSession>> sessionsFor(TutorialId tutorialId);
  Future<List<PracticeSession>> sessionsBetween(DateTime from, DateTime to);

  Future<void> upsertAlignmentPreset(AlignmentPreset preset);
  Future<AlignmentPreset?> alignmentFor(RecordingId recordingId);

  Future<UserSettings> readSettings();
  Future<void> writeSettings(UserSettings settings);
}
