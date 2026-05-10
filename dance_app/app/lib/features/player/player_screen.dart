import 'dart:async';

import 'package:core_api/core_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ui_kit/ui_kit.dart';
import 'package:video_engine_api/video_engine_api.dart';
import 'package:video_engine_media_kit/video_engine_media_kit.dart';

import '../../composition_root.dart';
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
    super.dispose();
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
              child: MediaKitVideoView(engine: engine),
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
