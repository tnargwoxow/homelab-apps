import 'dart:async';

import 'package:core_api/core_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_repo_api/media_repo_api.dart';
import 'package:metadata_store_api/metadata_store_api.dart';
import 'package:ui_kit/ui_kit.dart';
import 'package:video_engine_api/video_engine_api.dart';
import 'package:video_engine_media_kit/video_engine_media_kit.dart';

import '../../composition_root.dart';
import 'ghost_overlay.dart';
import 'player_providers.dart';

/// Player screen: video output, scrubber, play/pause, speed, A/B loop.
class PlayerScreen extends ConsumerStatefulWidget {
  const PlayerScreen({super.key});

  @override
  ConsumerState<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends ConsumerState<PlayerScreen> {
  TutorialId? _loadedTutorialId;

  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  PlaybackState _state = PlaybackState.idle;

  Duration? _loopStart;
  Duration? _loopEnd;
  double _rate = 1.0;

  StreamSubscription<Duration>? _positionSub;
  StreamSubscription<PlaybackState>? _stateSub;

  // Ghost playback state.
  bool _ghostOn = false;
  double _ghostOpacity = 0.45;
  RecordingMedia? _ghostRecording;
  AlignmentPreset? _ghostPreset;
  MediaKitVideoEngine? _ghostEngine;
  GhostSyncController? _ghostSync;
  String? _ghostError;

  @override
  void initState() {
    super.initState();
    final engine = ref.read(videoEngineProvider);
    _positionSub = engine.position.listen((p) {
      if (!mounted) {
        return;
      }
      setState(() {
        _position = p;
      });
    });
    _stateSub = engine.state.listen((s) {
      if (!mounted) {
        return;
      }
      setState(() {
        _state = s;
        if (s == PlaybackState.paused || s == PlaybackState.playing) {
          // Duration becomes valid after load; refresh.
          _duration = engine.duration;
        }
      });
    });
  }

  @override
  void dispose() {
    unawaited(_positionSub?.cancel());
    unawaited(_stateSub?.cancel());
    unawaited(_tearDownGhost());
    super.dispose();
  }

  Future<void> _tearDownGhost() async {
    final sync = _ghostSync;
    final engine = _ghostEngine;
    _ghostSync = null;
    _ghostEngine = null;
    if (sync != null) {
      await sync.dispose();
    }
    if (engine != null) {
      await engine.dispose();
    }
  }

  /// Looks up every recording for the current tutorial and pairs it with its
  /// AlignmentPreset (or null if not aligned). Used both to populate the
  /// ghost picker and to decide whether to enable the Ghost toggle.
  Future<List<(RecordingMedia, AlignmentPreset?)>> _alignedCandidates() async {
    final tutorialId = _loadedTutorialId;
    if (tutorialId == null) return const <(RecordingMedia, AlignmentPreset?)>[];
    final repo = ref.read(mediaRepositoryProvider);
    final store = ref.read(metadataStoreProvider);
    final recordings = await repo.listRecordings(tutorialId);
    final out = <(RecordingMedia, AlignmentPreset?)>[];
    for (final r in recordings) {
      out.add((r, await store.alignmentFor(r.id)));
    }
    return out;
  }

  Future<void> _setupGhost(
      {RecordingMedia? prefer, AlignmentPreset? preferPreset}) async {
    final candidates = await _alignedCandidates();
    final aligned = candidates
        .where((c) => c.$2 != null)
        .map((c) => (c.$1, c.$2!))
        .toList();
    if (aligned.isEmpty) {
      if (!mounted) return;
      setState(() {
        _ghostOn = false;
        _ghostError =
            'No aligned recordings yet. Align one in the Align tab first.';
      });
      return;
    }
    final pair = prefer != null && preferPreset != null
        ? (prefer, preferPreset)
        : aligned.first;
    final chosenRec = pair.$1;
    final chosenPreset = pair.$2;

    // Tear down any previous ghost engine before bringing up a new one.
    await _tearDownGhost();

    final engine = MediaKitVideoEngine();
    await engine.load(chosenRec.ref);
    final tutorialEngine = ref.read(videoEngineProvider);
    final sync = GhostSyncController(
      tutorial: tutorialEngine,
      recording: engine,
      preset: chosenPreset,
    )..start();
    if (!mounted) {
      await sync.dispose();
      await engine.dispose();
      return;
    }
    setState(() {
      _ghostRecording = chosenRec;
      _ghostPreset = chosenPreset;
      _ghostEngine = engine;
      _ghostSync = sync;
      _ghostError = null;
    });
    // Snap recording to the current tutorial position.
    await engine.seek(Duration(
      milliseconds: (_position.inMilliseconds -
              chosenPreset.tutorialKeyframeMs +
              chosenPreset.recordingKeyframeMs)
          .clamp(0, 1 << 31),
    ));
  }

  Future<void> _toggleGhost(bool on) async {
    setState(() {
      _ghostOn = on;
      _ghostError = null;
    });
    if (on) {
      await _setupGhost();
    } else {
      await _tearDownGhost();
      if (!mounted) return;
      setState(() {
        _ghostRecording = null;
        _ghostPreset = null;
      });
    }
  }

  Future<void> _pickGhostRecording() async {
    final candidates = await _alignedCandidates();
    final aligned = candidates
        .where((c) => c.$2 != null)
        .map((c) => (c.$1, c.$2!))
        .toList();
    if (!mounted) return;
    if (aligned.isEmpty) {
      setState(() => _ghostError = 'No aligned recordings to choose from.');
      return;
    }
    final selected =
        await showModalBottomSheet<(RecordingMedia, AlignmentPreset)>(
      context: context,
      builder: (ctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: <Widget>[
            const Padding(
              padding: EdgeInsets.all(12),
              child: Text('Choose a recording to ghost'),
            ),
            for (final pair in aligned)
              ListTile(
                leading: const Icon(Icons.layers_outlined),
                title: Text(pair.$1.createdAt
                    .toIso8601String()
                    .substring(0, 16)
                    .replaceAll('T', ' ')),
                subtitle: Text(
                  '${pair.$1.duration.inSeconds}s · ${pair.$1.type.name}',
                ),
                trailing: pair.$1.id == _ghostRecording?.id
                    ? const Icon(Icons.check)
                    : null,
                onTap: () => Navigator.of(ctx).pop(pair),
              ),
          ],
        ),
      ),
    );
    if (selected == null || !mounted) return;
    await _setupGhost(prefer: selected.$1, preferPreset: selected.$2);
  }

  Future<void> _ensureLoaded(TutorialId? id) async {
    if (id == null || id == _loadedTutorialId) {
      return;
    }
    final repo = ref.read(mediaRepositoryProvider);
    final tutorial = await repo.getTutorial(id);
    if (tutorial == null || !mounted) {
      return;
    }
    final engine = ref.read(videoEngineProvider);
    await engine.load(tutorial.ref);
    if (!mounted) {
      return;
    }
    setState(() {
      _loadedTutorialId = id;
      _duration = tutorial.duration > Duration.zero
          ? tutorial.duration
          : engine.duration;
      _position = Duration.zero;
      _loopStart = null;
      _loopEnd = null;
    });
  }

  void _onTogglePlayPause() {
    final engine = ref.read(videoEngineProvider);
    if (_state == PlaybackState.playing) {
      unawaited(engine.pause());
    } else {
      unawaited(engine.play());
    }
  }

  void _onSeek(Duration to) {
    final engine = ref.read(videoEngineProvider);
    unawaited(engine.seek(to));
  }

  void _onSetLoopStart(Duration at) {
    setState(() {
      _loopStart = at;
    });
    _maybeApplyLoop();
  }

  void _onSetLoopEnd(Duration at) {
    setState(() {
      _loopEnd = at;
    });
    _maybeApplyLoop();
  }

  void _maybeApplyLoop() {
    final a = _loopStart;
    final b = _loopEnd;
    if (a == null || b == null || a >= b) {
      return;
    }
    final engine = ref.read(videoEngineProvider);
    unawaited(engine.setLoop(LoopRange(start: a, end: b)));
  }

  void _onClearLoop() {
    setState(() {
      _loopStart = null;
      _loopEnd = null;
    });
    final engine = ref.read(videoEngineProvider);
    unawaited(engine.setLoop(null));
  }

  void _onRateChanged(double rate) {
    setState(() {
      _rate = rate;
    });
    final engine = ref.read(videoEngineProvider);
    unawaited(engine.setRate(rate, preservePitch: true));
  }

  @override
  Widget build(BuildContext context) {
    final selected = ref.watch(selectedTutorialIdProvider);
    // Kick off load when selection changes; intentionally fire-and-forget.
    if (selected != null && selected != _loadedTutorialId) {
      unawaited(_ensureLoaded(selected));
    }

    if (selected == null) {
      return const Scaffold(
        body: SafeArea(
          child: EmptyState(
            icon: Icons.play_circle_outline,
            title: 'No tutorial selected',
            message: 'Pick a tutorial in the Library.',
          ),
        ),
      );
    }

    final engine = ref.watch(videoEngineProvider);
    final isPlaying = _state == PlaybackState.playing;
    final hasLoop = _loopStart != null && _loopEnd != null;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: <Widget>[
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Stack(
                fit: StackFit.expand,
                children: <Widget>[
                  MediaKitVideoView(engine: engine),
                  if (_ghostOn && _ghostEngine != null && _ghostPreset != null)
                    GhostOverlay(
                      engine: _ghostEngine!,
                      preset: _ghostPreset!,
                      opacity: _ghostOpacity,
                    ),
                ],
              ),
            ),
            TimelineScrubber(
              position: _position,
              duration: _duration,
              loopStart: _loopStart,
              loopEnd: _loopEnd,
              onSeek: _onSeek,
              onSetLoopStart: _onSetLoopStart,
              onSetLoopEnd: _onSetLoopEnd,
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                IconButton(
                  iconSize: 48,
                  onPressed: _onTogglePlayPause,
                  icon: Icon(
                    isPlaying ? Icons.pause_circle : Icons.play_circle,
                  ),
                ),
              ],
            ),
            SpeedControl(value: _rate, onChanged: _onRateChanged),
            _GhostControls(
              isOn: _ghostOn,
              opacity: _ghostOpacity,
              recording: _ghostRecording,
              error: _ghostError,
              onToggle: (v) => unawaited(_toggleGhost(v)),
              onOpacity: (v) => setState(() => _ghostOpacity = v),
              onPick: () => unawaited(_pickGhostRecording()),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: <Widget>[
                  Text('Loops', style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(width: 12),
                  if (hasLoop)
                    Expanded(
                      child: Wrap(
                        spacing: 8,
                        children: <Widget>[
                          LoopMarkerChip(
                            label: 'A-B',
                            start: _loopStart!,
                            end: _loopEnd!,
                            selected: true,
                            onTap: () => _onSeek(_loopStart!),
                            onDelete: _onClearLoop,
                          ),
                        ],
                      ),
                    )
                  else
                    Expanded(
                      child: Text(
                        'Tap A then B on the scrubber to set a loop.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                  if (hasLoop)
                    TextButton(
                      onPressed: _onClearLoop,
                      child: const Text('Clear loop'),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GhostControls extends StatelessWidget {
  const _GhostControls({
    required this.isOn,
    required this.opacity,
    required this.recording,
    required this.error,
    required this.onToggle,
    required this.onOpacity,
    required this.onPick,
  });

  final bool isOn;
  final double opacity;
  final RecordingMedia? recording;
  final String? error;
  final ValueChanged<bool> onToggle;
  final ValueChanged<double> onOpacity;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              const Icon(Icons.layers_outlined, size: 18),
              const SizedBox(width: 8),
              Text('Ghost', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(width: 12),
              Switch(value: isOn, onChanged: onToggle),
              const SizedBox(width: 12),
              if (isOn && recording != null)
                Expanded(
                  child: Text(
                    'Overlay: ${recording!.createdAt.toIso8601String().substring(0, 16).replaceAll('T', ' ')}',
                    style: Theme.of(context).textTheme.bodySmall,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              if (isOn)
                TextButton.icon(
                  onPressed: onPick,
                  icon: const Icon(Icons.swap_horiz, size: 18),
                  label: const Text('Change'),
                ),
            ],
          ),
          if (isOn && recording != null)
            Slider(value: opacity, onChanged: onOpacity),
          if (error != null)
            Text(
              error!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.error,
                  ),
            ),
        ],
      ),
    );
  }
}
