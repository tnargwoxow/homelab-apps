import 'package:camera/camera.dart' as cam;
import 'package:camera_service_api/camera_service_api.dart';
import 'package:flutter/material.dart';

import 'camera_service_impl.dart';

/// Renders the live preview of a [CameraService].
///
/// If the service is a [CameraServiceImpl] and its underlying controller is
/// initialised, this delegates to `package:camera`'s [cam.CameraPreview].
/// Otherwise it shows a black placeholder so the practice screen stays
/// laid-out while the camera comes up (or when wired to a fake in tests).
class CameraPreviewView extends StatelessWidget {
  const CameraPreviewView(
      {super.key, required this.service, this.mirror = false});

  final CameraService service;

  /// Mirror horizontally — useful for the front camera where users expect a
  /// selfie-style flip.
  final bool mirror;

  @override
  Widget build(BuildContext context) {
    final s = service;
    if (s is! CameraServiceImpl) {
      return _placeholder();
    }
    final controller = s.controller;
    if (controller == null || !controller.value.isInitialized) {
      return _placeholder();
    }
    final preview = cam.CameraPreview(controller);
    if (!mirror) {
      return preview;
    }
    return Transform(
      alignment: Alignment.center,
      transform: Matrix4.identity()..setEntry(0, 0, -1),
      child: preview,
    );
  }

  Widget _placeholder() => const ColoredBox(color: Colors.black);
}
