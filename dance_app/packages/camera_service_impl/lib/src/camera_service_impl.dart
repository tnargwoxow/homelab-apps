import 'dart:async';

import 'package:camera/camera.dart';
import 'package:camera_service_api/camera_service_api.dart';
import 'package:core_api/core_api.dart';

/// [CameraService] backed by the official `camera` plugin. Works on iOS,
/// Android and (with feature gaps) web.
///
/// Web caveats: `camera_web` supports preview but recording is best-effort
/// — `startVideoRecording` is implemented via MediaRecorder where the browser
/// supports it, otherwise it throws.
class CameraServiceImpl implements CameraService {
  CameraServiceImpl();

  CameraController? _controller;
  List<CameraDescription> _cameras = const <CameraDescription>[];

  CameraSide _side = CameraSide.front;
  bool _previewing = false;
  bool _recording = false;
  DateTime? _recordingStart;

  final StreamController<CameraStatus> _statusController =
      StreamController<CameraStatus>.broadcast();

  @override
  Stream<CameraStatus> get status => _statusController.stream;

  /// The underlying [CameraController]. Exposed so the matching preview
  /// widget can render the platform texture.
  CameraController? get controller => _controller;

  /// Whether the controller is initialised and ready for preview.
  bool get isReady => _controller?.value.isInitialized ?? false;

  void _emit() {
    _statusController.add(
      CameraStatus(
        side: _side,
        isPreviewing: _previewing,
        isRecording: _recording,
      ),
    );
  }

  Future<void> _ensureCameras() async {
    if (_cameras.isEmpty) {
      _cameras = await availableCameras();
    }
  }

  CameraDescription _pick(CameraSide side) {
    final wanted = side == CameraSide.front
        ? CameraLensDirection.front
        : CameraLensDirection.back;
    return _cameras.firstWhere(
      (c) => c.lensDirection == wanted,
      orElse: () => _cameras.first,
    );
  }

  @override
  Future<void> start({CameraSide side = CameraSide.front}) async {
    await _ensureCameras();
    if (_cameras.isEmpty) {
      throw StateError('No cameras available on this device.');
    }
    _side = side;

    // Tear down any prior controller before bringing up a fresh one.
    final old = _controller;
    if (old != null) {
      await old.dispose();
      _controller = null;
    }

    final controller = CameraController(
      _pick(side),
      ResolutionPreset.medium,
      enableAudio: true,
    );
    await controller.initialize();
    _controller = controller;
    _previewing = true;
    _emit();
  }

  @override
  Future<void> stop() async {
    final c = _controller;
    if (c != null) {
      if (_recording) {
        try {
          await c.stopVideoRecording();
        } catch (_) {
          // Swallow: stop() should be tolerant of dirty state.
        }
      }
      await c.dispose();
      _controller = null;
    }
    _previewing = false;
    _recording = false;
    _recordingStart = null;
    _emit();
  }

  @override
  Future<void> switchSide() async {
    final next = _side == CameraSide.front ? CameraSide.back : CameraSide.front;
    if (_previewing) {
      await start(side: next);
    } else {
      _side = next;
      _emit();
    }
  }

  @override
  Future<void> startRecording() async {
    final c = _controller;
    if (c == null || !c.value.isInitialized) {
      throw StateError('Camera not started.');
    }
    if (_recording) {
      return;
    }
    await c.startVideoRecording();
    _recording = true;
    _recordingStart = DateTime.now();
    _emit();
  }

  @override
  Future<RecordingResult> stopRecording() async {
    final c = _controller;
    if (c == null) {
      throw StateError('Camera not started.');
    }
    if (!_recording) {
      throw StateError('Not currently recording.');
    }
    final file = await c.stopVideoRecording();
    final start = _recordingStart ?? DateTime.now();
    _recording = false;
    _recordingStart = null;
    _emit();
    return RecordingResult(
      ref: MediaRef(
        uri: file.path,
        sourceType: MediaSourceType.localFile,
      ),
      duration: DateTime.now().difference(start),
    );
  }

  @override
  Future<void> dispose() async {
    await stop();
    await _statusController.close();
  }
}
