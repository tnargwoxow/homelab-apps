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

/// Recordings for a given tutorial. Watched by the practice screen.
final recordingsProvider =
    FutureProvider.family<List<RecordingMedia>, TutorialId>((ref, id) async {
  final repo = ref.watch(mediaRepositoryProvider);
  return repo.listRecordings(id);
});

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
          ref.invalidate(recordingsProvider(tutorialId));
          if (mounted) {
            final secs = result.duration.inMilliseconds / 1000;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  'Recording saved (${secs.toStringAsFixed(1)}s)',
                ),
                duration: const Duration(seconds: 2),
              ),
            );
          }
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
          const Divider(height: 24),
          Expanded(child: _RecordingsList(tutorialId: selected)),
        ],
      ),
    );
  }
}

class _RecordingsList extends ConsumerWidget {
  const _RecordingsList({required this.tutorialId});

  final TutorialId tutorialId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncRecs = ref.watch(recordingsProvider(tutorialId));
    return asyncRecs.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Padding(
        padding: const EdgeInsets.all(16),
        child: Text(
          'Failed to load recordings: $e',
          style: TextStyle(color: Theme.of(context).colorScheme.error),
        ),
      ),
      data: (recordings) {
        if (recordings.isEmpty) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Text(
              'Your recordings will show here.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                'Your recordings (${recordings.length})',
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ),
            const SizedBox(height: 4),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                itemCount: recordings.length,
                separatorBuilder: (_, __) => const SizedBox(height: 4),
                itemBuilder: (context, i) {
                  final r = recordings[i];
                  final secs =
                      (r.duration.inMilliseconds / 1000).toStringAsFixed(1);
                  final ts = r.createdAt.toLocal();
                  return ListTile(
                    leading: const Icon(Icons.movie_outlined),
                    title: Text('${secs}s · ${_formatTimestamp(ts)}'),
                    subtitle: Text(r.type.name,
                        style: Theme.of(context).textTheme.bodySmall),
                    trailing: IconButton(
                      tooltip: 'Delete',
                      icon: const Icon(Icons.delete_outline),
                      onPressed: () async {
                        await ref
                            .read(mediaRepositoryProvider)
                            .deleteRecording(r.id);
                        ref.invalidate(recordingsProvider(tutorialId));
                      },
                    ),
                    onTap: () => _showRecordingDialog(context, r),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }

  String _formatTimestamp(DateTime dt) {
    String two(int n) => n.toString().padLeft(2, '0');
    return '${dt.year}-${two(dt.month)}-${two(dt.day)} '
        '${two(dt.hour)}:${two(dt.minute)}';
  }
}

Future<void> _showRecordingDialog(BuildContext context, RecordingMedia r) {
  return showDialog<void>(
    context: context,
    builder: (ctx) => Dialog(
      child: SizedBox(
        width: 480,
        child: _RecordingPlayer(recording: r),
      ),
    ),
  );
}

class _RecordingPlayer extends StatefulWidget {
  const _RecordingPlayer({required this.recording});
  final RecordingMedia recording;

  @override
  State<_RecordingPlayer> createState() => _RecordingPlayerState();
}

class _RecordingPlayerState extends State<_RecordingPlayer> {
  late final MediaKitVideoEngine _engine;
  bool _ready = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    MediaKitVideoEngine.ensureInitialized();
    _engine = MediaKitVideoEngine();
    _load();
  }

  Future<void> _load() async {
    try {
      await _engine.load(widget.recording.ref);
      await _engine.play();
      if (mounted) setState(() => _ready = true);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  @override
  void dispose() {
    unawaited(_engine.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        AspectRatio(
          aspectRatio: 16 / 9,
          child: _error != null
              ? Center(child: Text(_error!))
              : _ready
                  ? MediaKitVideoView(engine: _engine)
                  : const Center(child: CircularProgressIndicator()),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: <Widget>[
            TextButton(
              onPressed: () => unawaited(_engine.play()),
              child: const Text('Play'),
            ),
            TextButton(
              onPressed: () => unawaited(_engine.pause()),
              child: const Text('Pause'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Close'),
            ),
          ],
        ),
      ],
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
