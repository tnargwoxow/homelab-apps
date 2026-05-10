/// Public interface for camera preview and recording.
library camera_service_api;

import 'package:core_api/core_api.dart';
import 'package:meta/meta.dart';

enum CameraSide { front, back }

@immutable
class CameraStatus {
  const CameraStatus({
    required this.side,
    required this.isPreviewing,
    required this.isRecording,
  });
  final CameraSide side;
  final bool isPreviewing;
  final bool isRecording;
}

@immutable
class RecordingResult {
  const RecordingResult({
    required this.ref,
    required this.duration,
  });
  final MediaRef ref;
  final Duration duration;
}

abstract interface class CameraService {
  Future<void> start({CameraSide side = CameraSide.front});
  Future<void> stop();
  Future<void> switchSide();

  Future<void> startRecording();

  /// Stops recording and returns the resulting media reference.
  Future<RecordingResult> stopRecording();

  Stream<CameraStatus> get status;

  Future<void> dispose();
}
