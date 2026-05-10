import 'dart:async';

import 'package:camera_service_api/camera_service_api.dart';
import 'package:core_api/core_api.dart';

class FakeCameraService implements CameraService {
  FakeCameraService();

  final StreamController<CameraStatus> _status =
      StreamController<CameraStatus>.broadcast();

  CameraSide _side = CameraSide.front;
  bool _previewing = false;
  bool _recording = false;
  DateTime? _recordingStart;

  void _emit() => _status.add(
        CameraStatus(
          side: _side,
          isPreviewing: _previewing,
          isRecording: _recording,
        ),
      );

  @override
  Stream<CameraStatus> get status => _status.stream;

  @override
  Future<void> start({CameraSide side = CameraSide.front}) async {
    _side = side;
    _previewing = true;
    _emit();
  }

  @override
  Future<void> stop() async {
    _previewing = false;
    _emit();
  }

  @override
  Future<void> switchSide() async {
    _side = _side == CameraSide.front ? CameraSide.back : CameraSide.front;
    _emit();
  }

  @override
  Future<void> startRecording() async {
    _recording = true;
    _recordingStart = DateTime.now();
    _emit();
  }

  @override
  Future<RecordingResult> stopRecording() async {
    _recording = false;
    final start = _recordingStart ?? DateTime.now();
    _recordingStart = null;
    _emit();
    return RecordingResult(
      ref: const MediaRef(
          uri: 'fake://recording', sourceType: MediaSourceType.localFile),
      duration: DateTime.now().difference(start),
    );
  }

  @override
  Future<void> dispose() async {
    await _status.close();
  }
}
