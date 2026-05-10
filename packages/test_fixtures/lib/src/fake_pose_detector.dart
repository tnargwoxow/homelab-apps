import 'dart:async';

import 'package:core_api/core_api.dart';
import 'package:pose_detection_api/pose_detection_api.dart';

class FakePoseDetector implements PoseDetector {
  FakePoseDetector();

  PoseFrame _staticPose(int frameMs) {
    Keypoint k(Joint j, double x, double y) =>
        Keypoint(joint: j, position: Point2(x, y), confidence: 0.99);
    return PoseFrame(
      frameMs: frameMs,
      keypoints: <Joint, Keypoint>{
        Joint.nose: k(Joint.nose, 0.5, 0.2),
        Joint.leftWrist: k(Joint.leftWrist, 0.35, 0.5),
        Joint.rightWrist: k(Joint.rightWrist, 0.65, 0.5),
        Joint.leftAnkle: k(Joint.leftAnkle, 0.4, 0.9),
        Joint.rightAnkle: k(Joint.rightAnkle, 0.6, 0.9),
      },
    );
  }

  @override
  Future<PoseFrame?> detect(FrameSample sample) async =>
      _staticPose(sample.frameMs);

  @override
  Stream<PoseFrame> detectStream(Stream<FrameSample> samples) =>
      samples.map((s) => _staticPose(s.frameMs));

  @override
  Future<void> dispose() async {}
}
