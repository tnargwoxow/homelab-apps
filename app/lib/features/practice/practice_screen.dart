import 'dart:async';

import 'package:camera_service_api/camera_service_api.dart';
import 'package:camera_service_impl/camera_service_impl.dart';
import 'package:core_api/core_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_repo_api/media_repo_api.dart';
import 'package:ui_kit/ui_kit.dart';
import 'package:video_engine_media_kit/video_engine_media_kit.dart';

import '../../composition_root.dart';
import '../player/player_providers.dart';

/// Live practice mode: tutorial video underneath, camera preview composited
/// on top at adjustable opacity, with a record button that saves the camera
/// stream as a recording.
class PracticeScreen extends ConsumerStatefulWidget {
  const PracticeScreen({super.key});

  @override
  ConsumerState<PracticeScreen> createState() => _PracticeScreenState();
}

class _PracticeScreenState extends ConsumerState<PracticeScreen> {
  TutorialId? _loadedTutorialId;

  bool _cameraOn = false;
  bool _recording = false;
  bool _busy = false;

  double _overlayOpacity = 0.5;
  bool _mirror = true;
  CameraSide _side = CameraSide.front;
  String? _errorText;

  StreamSubscription<CameraStatus>? _statusSub;

  @override
  void initState() {
    super.initState();
    final camera = ref.read(cameraServiceProvider);
    _statusSub = camera.status.listen((s) {
      if (!mounted) return;
      setState(() {
        _cameraOn = s.isPreviewing;
        _recording = s.isRecording;
        _side = s.side;
      });
    });
  }

  @override
  void dispose() {
    unawaited(_statusSub?.cancel());
    // Don't dispose the camera here; it's a process-wide singleton via the
    // composition root and other screens may want it.
    final camera = ref.read(cameraServiceProvider);
    if (_recording) {
      unawaited(camera.stopRecording().catchError((_) {
        return const RecordingResult(
          ref: MediaRef(uri: '', sourceType: MediaSourceType.localFile),
          duration: Duration.zero,
        );
      }));
    }
    if (_cameraOn) {
      unawaited(camera.stop());
    }
    super.dispose();
  }

  Future<void> _ensureTutorialLoaded(TutorialId id) async {
    if (id == _loadedTutorialId) return;
    final repo = ref.read(mediaRepositoryProvider);
    final tutorial = await repo.getTutorial(id);
    if (tutorial == null || !mounted) return;
    final engine = ref.read(videoEngineProvider);
    await engine.load(tutorial.ref);
    if (!mounted) return;
    setState(() => _loadedTutorialId = id);
  }

  Future<void> _toggleCamera() async {
    final camera = ref.read(cameraServiceProvider);
    setState(() {
      _busy = true;
      _errorText = null;
    });
    try {
      if (_cameraOn) {
        await camera.stop();
      } else {
        await camera.start(side: _side);
      }
    } catch (e) {
      setState(() => _errorText = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _switchSide() async {
    final camera = ref.read(cameraServiceProvider);
    setState(() => _busy = true);
    try {
      await camera.switchSide();
    } catch (e) {
      setState(() => _errorText = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _toggleTutorialPlay() async {
    final engine = ref.read(videoEngineProvider);
    if (engine is MediaKitVideoEngine) {
      // Best-effort: we don't track engine state locally on this screen, so
      // toggle by reading current state via a tiny stream peek. Simpler:
      // just call play; calling play while playing is idempotent on libmpv.
    }
    await engine.play();
  }

  Future<void> _toggleRecord() async {
    final camera = ref.read(cameraServiceProvider);
    final tutorialId = ref.read(selectedTutorialIdProvider);
    if (!_cameraOn) {
      setState(() => _errorText = 'Start the camera first.');
      return;
    }
    setState(() => _busy = true);
    try {
      if (_recording) {
        final result = await camera.stopRecording();
        if (tutorialId != null && result.ref.uri.isNotEmpty) {
          final repo = ref.read(mediaRepositoryProvider);
          await repo.saveRecording(
            tutorialId: tutorialId,
            sourceRef: result.ref,
            duration: result.duration,
            type: RecordingType.liveOverlay,
          );
        }
      } else {
        await camera.startRecording();
      }
    } catch (e) {
      setState(() => _errorText = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final selected = ref.watch(selectedTutorialIdProvider);
    if (selected != null && selected != _loadedTutorialId) {
      unawaited(_ensureTutorialLoaded(selected));
    }

    if (selected == null) {
      return const Scaffold(
        body: SafeArea(
          child: EmptyState(
            icon: Icons.videocam_outlined,
            title: 'No tutorial selected',
            message: 'Pick a tutorial in the Library to practise to.',
          ),
        ),
      );
    }

    final engine = ref.watch(videoEngineProvider);
    final camera = ref.watch(cameraServiceProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Practice'),
        actions: <Widget>[
          IconButton(
            tooltip: _mirror ? 'Mirror: on' : 'Mirror: off',
            icon: Icon(_mirror ? Icons.flip : Icons.flip_outlined),
            onPressed: () => setState(() => _mirror = !_mirror),
          ),
          IconButton(
            tooltip: 'Switch camera',
            icon: Icon(_side == CameraSide.front
                ? Icons.camera_front_outlined
                : Icons.camera_rear_outlined),
            onPressed: _busy ? null : _switchSide,
          ),
        ],
      ),
      body: Column(
        children: <Widget>[
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: <Widget>[
                MediaKitVideoView(engine: engine),
                if (_cameraOn)
                  IgnorePointer(
                    child: Opacity(
                      opacity: _overlayOpacity,
                      child:
                          CameraPreviewView(service: camera, mirror: _mirror),
                    ),
                  ),
                if (_recording)
                  const Positioned(
                    top: 8,
                    left: 8,
                    child: _RecordingDot(),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: <Widget>[
                const Text('Overlay'),
                Expanded(
                  child: Slider(
                    value: _overlayOpacity,
                    onChanged: _cameraOn
                        ? (v) => setState(() => _overlayOpacity = v)
                        : null,
                  ),
                ),
                Text('${(_overlayOpacity * 100).round()}%'),
              ],
            ),
          ),
          if (_errorText != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                _errorText!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: <Widget>[
              FilledButton.tonalIcon(
                onPressed: _busy ? null : _toggleCamera,
                icon: Icon(_cameraOn ? Icons.videocam_off : Icons.videocam),
                label: Text(_cameraOn ? 'Stop camera' : 'Start camera'),
              ),
              FilledButton.tonalIcon(
                onPressed: _busy ? null : _toggleTutorialPlay,
                icon: const Icon(Icons.play_arrow),
                label: const Text('Play tutorial'),
              ),
              FilledButton.icon(
                onPressed: _busy || !_cameraOn ? null : _toggleRecord,
                icon: Icon(
                  _recording ? Icons.stop_circle : Icons.fiber_manual_record,
                ),
                label: Text(_recording ? 'Stop' : 'Record'),
                style: FilledButton.styleFrom(
                  backgroundColor:
                      _recording ? Theme.of(context).colorScheme.error : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'Recording saves the camera stream only. Compositing the '
              'tutorial + camera into a single MP4 lands in a later phase.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}

class _RecordingDot extends StatelessWidget {
  const _RecordingDot();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(Icons.fiber_manual_record, color: Colors.red, size: 12),
          SizedBox(width: 4),
          Text('REC', style: TextStyle(color: Colors.white, fontSize: 12)),
        ],
      ),
    );
  }
}
