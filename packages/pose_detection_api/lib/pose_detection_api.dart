/// Public interface for on-device pose detection.
///
/// Mobile impls use ML Kit; the web impl wraps MediaPipe Pose JS via interop.
/// Both expose the same five canonical joints used by alignment: nose,
/// leftWrist, rightWrist, leftAnkle, rightAnkle.
library pose_detection_api;

import 'package:core_api/core_api.dart';
import 'package:meta/meta.dart';

enum Joint { nose, leftWrist, rightWrist, leftAnkle, rightAnkle }

@immutable
class Keypoint {
  const Keypoint({
    required this.joint,
    required this.position,
    required this.confidence,
  });
  final Joint joint;
  final Point2 position;
  final double confidence;
}

@immutable
class PoseFrame {
  const PoseFrame({required this.frameMs, required this.keypoints});
  final int frameMs;
  final Map<Joint, Keypoint> keypoints;

  Keypoint? operator [](Joint j) => keypoints[j];
}

/// A frame of media to analyse. Implementations interpret [bytes] according
/// to their platform conventions (NV21 / BGRA / RGBA on mobile, ImageData on web).
@immutable
class FrameSample {
  const FrameSample({
    required this.frameMs,
    required this.width,
    required this.height,
    required this.bytes,
  });
  final int frameMs;
  final int width;
  final int height;
  final List<int> bytes;
}

abstract interface class PoseDetector {
  Future<PoseFrame?> detect(FrameSample sample);
  Stream<PoseFrame> detectStream(Stream<FrameSample> samples);
  Future<void> dispose();
}
