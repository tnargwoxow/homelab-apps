import 'dart:async';

import 'package:alignment/alignment.dart';
import 'package:core_api/core_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_repo_api/media_repo_api.dart';
import 'package:metadata_store_api/metadata_store_api.dart';
import 'package:ui_kit/ui_kit.dart';
import 'package:video_engine_api/video_engine_api.dart';
import 'package:video_engine_media_kit/video_engine_media_kit.dart';

import '../../composition_root.dart';
import '../player/player_providers.dart';

/// Manual 5-point alignment: pick a recording, scrub to a frame on each side,
/// tap matching anatomical points, and save the resulting affine transform
/// as an [AlignmentPreset].
class AlignmentScreen extends ConsumerStatefulWidget {
  const AlignmentScreen({super.key});

  @override
  ConsumerState<AlignmentScreen> createState() => _AlignmentScreenState();
}

class _AlignmentScreenState extends ConsumerState<AlignmentScreen> {
  late final MediaKitVideoEngine _tutorialEngine;
  late final MediaKitVideoEngine _recordingEngine;

  TutorialId? _loadedTutorialId;
  RecordingId? _selectedRecordingId;
  RecordingId? _loadedRecordingId;

  Duration _tutorialPos = Duration.zero;
  Duration _tutorialDur = Duration.zero;
  Duration _recordingPos = Duration.zero;
  Duration _recordingDur = Duration.zero;

  final List<Point2> _tutorialPts = <Point2>[];
  final List<Point2> _recordingPts = <Point2>[];

  double? _lastRms;
  String? _statusText;

  StreamSubscription<Duration>? _tutPosSub;
  StreamSubscription<Duration>? _recPosSub;
  StreamSubscription<PlaybackState>? _tutStateSub;
  StreamSubscription<PlaybackState>? _recStateSub;

  static const int _maxPoints = 5;

  @override
  void initState() {
    super.initState();
    MediaKitVideoEngine.ensureInitialized();
    _tutorialEngine = MediaKitVideoEngine();
    _recordingEngine = MediaKitVideoEngine();

    _tutPosSub = _tutorialEngine.position.listen((p) {
      if (!mounted) return;
      setState(() => _tutorialPos = p);
    });
    _recPosSub = _recordingEngine.position.listen((p) {
      if (!mounted) return;
      setState(() => _recordingPos = p);
    });
    _tutStateSub = _tutorialEngine.state.listen((_) {
      if (!mounted) return;
      setState(() => _tutorialDur = _tutorialEngine.duration);
    });
    _recStateSub = _recordingEngine.state.listen((_) {
      if (!mounted) return;
      setState(() => _recordingDur = _recordingEngine.duration);
    });
  }

  @override
  void dispose() {
    unawaited(_tutPosSub?.cancel());
    unawaited(_recPosSub?.cancel());
    unawaited(_tutStateSub?.cancel());
    unawaited(_recStateSub?.cancel());
    unawaited(_tutorialEngine.dispose());
    unawaited(_recordingEngine.dispose());
    super.dispose();
  }

  Future<void> _ensureTutorialLoaded(TutorialId id) async {
    if (id == _loadedTutorialId) return;
    final repo = ref.read(mediaRepositoryProvider);
    final tutorial = await repo.getTutorial(id);
    if (tutorial == null || !mounted) return;
    await _tutorialEngine.load(tutorial.ref);
    if (!mounted) return;
    setState(() {
      _loadedTutorialId = id;
      _selectedRecordingId = null;
      _loadedRecordingId = null;
      _tutorialPts.clear();
      _recordingPts.clear();
      _lastRms = null;
      _statusText = null;
    });
  }

  Future<void> _ensureRecordingLoaded(RecordingId id) async {
    if (id == _loadedRecordingId) return;
    final repo = ref.read(mediaRepositoryProvider);
    final rec = await repo.getRecording(id);
    if (rec == null || !mounted) return;
    await _recordingEngine.load(rec.ref);
    if (!mounted) return;
    setState(() {
      _loadedRecordingId = id;
      _recordingPts.clear();
      _lastRms = null;
      _statusText = null;
    });
  }

  void _onTapTutorial(Offset local, Size size) {
    if (_tutorialPts.length >= _maxPoints) return;
    setState(() {
      _tutorialPts.add(_normalize(local, size));
      _statusText = null;
    });
  }

  void _onTapRecording(Offset local, Size size) {
    if (_recordingPts.length >= _maxPoints) return;
    setState(() {
      _recordingPts.add(_normalize(local, size));
      _statusText = null;
    });
  }

  Point2 _normalize(Offset local, Size size) {
    final x = (local.dx / size.width).clamp(0.0, 1.0);
    final y = (local.dy / size.height).clamp(0.0, 1.0);
    return Point2(x, y);
  }

  void _undoLast() {
    setState(() {
      // Pop from whichever side has more points; keep the two lists
      // length-balanced so a save attempt always pairs them up.
      if (_tutorialPts.length > _recordingPts.length &&
          _tutorialPts.isNotEmpty) {
        _tutorialPts.removeLast();
      } else if (_recordingPts.isNotEmpty) {
        _recordingPts.removeLast();
      } else if (_tutorialPts.isNotEmpty) {
        _tutorialPts.removeLast();
      }
      _lastRms = null;
      _statusText = null;
    });
  }

  void _clearAll() {
    setState(() {
      _tutorialPts.clear();
      _recordingPts.clear();
      _lastRms = null;
      _statusText = null;
    });
  }

  Future<void> _save() async {
    if (_tutorialPts.length != _recordingPts.length) {
      setState(() => _statusText =
          'Need the same number of points on both sides (${_tutorialPts.length} vs ${_recordingPts.length}).');
      return;
    }
    if (_tutorialPts.length < Aligner.minPoints) {
      setState(() => _statusText =
          'Need at least ${Aligner.minPoints} points. Tap matching landmarks (head, hips, hands, feet).');
      return;
    }
    final tutorialId = _loadedTutorialId;
    final recordingId = _loadedRecordingId;
    if (tutorialId == null || recordingId == null) {
      return;
    }

    const aligner = Aligner();
    try {
      final fit = aligner.compute(
        from: List<Point2>.unmodifiable(_recordingPts),
        to: List<Point2>.unmodifiable(_tutorialPts),
      );
      final rms = aligner.rmsError(
        transform: fit,
        from: _recordingPts,
        to: _tutorialPts,
      );
      final preset = AlignmentPreset(
        id: 'manual-${DateTime.now().microsecondsSinceEpoch}',
        recordingId: recordingId,
        tutorialId: tutorialId,
        tutorialKeyframeMs: _tutorialPos.inMilliseconds,
        recordingKeyframeMs: _recordingPos.inMilliseconds,
        matrix: fit.matrix,
        isAi: false,
        createdAt: DateTime.now(),
      );
      final store = ref.read(metadataStoreProvider);
      await store.upsertAlignmentPreset(preset);
      if (!mounted) return;
      setState(() {
        _lastRms = rms;
        _statusText =
            'Saved. RMS error ${(rms * 100).toStringAsFixed(2)}% of frame size.';
      });
    } on ArgumentError catch (e) {
      if (!mounted) return;
      setState(() => _statusText = 'Could not fit: ${e.message}');
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
            icon: Icons.center_focus_strong_outlined,
            title: 'No tutorial selected',
            message: 'Pick a tutorial in the Library, then come back here.',
          ),
        ),
      );
    }

    final recordingsAsync = ref.watch(_recordingsListProvider(selected));

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              recordingsAsync.when(
                data: (recs) => _RecordingPicker(
                  recordings: recs,
                  selectedId: _selectedRecordingId,
                  onChanged: (id) {
                    setState(() => _selectedRecordingId = id);
                    if (id != null) {
                      unawaited(_ensureRecordingLoaded(id));
                    }
                  },
                ),
                loading: () => const LinearProgressIndicator(),
                error: (e, _) => Text('Failed to load recordings: $e'),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final stacked = constraints.maxWidth < 720;
                    final panels = <Widget>[
                      Expanded(
                        child: _AlignmentPanel(
                          title: 'Tutorial',
                          engine: _tutorialEngine,
                          position: _tutorialPos,
                          duration: _tutorialDur,
                          points: _tutorialPts,
                          onTap: _onTapTutorial,
                          onSeek: _tutorialEngine.seek,
                          onTogglePlay: () => _toggleEngine(_tutorialEngine),
                          isLoaded: _loadedTutorialId != null,
                          emptyMessage: 'Tutorial loading…',
                        ),
                      ),
                      const SizedBox(width: 8, height: 8),
                      Expanded(
                        child: _AlignmentPanel(
                          title: 'Recording',
                          engine: _recordingEngine,
                          position: _recordingPos,
                          duration: _recordingDur,
                          points: _recordingPts,
                          onTap: _onTapRecording,
                          onSeek: _recordingEngine.seek,
                          onTogglePlay: () => _toggleEngine(_recordingEngine),
                          isLoaded: _loadedRecordingId != null,
                          emptyMessage: 'Pick a recording above.',
                        ),
                      ),
                    ];
                    return stacked
                        ? Column(children: panels)
                        : Row(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: panels,
                          );
                  },
                ),
              ),
              const SizedBox(height: 8),
              _ControlBar(
                tutorialPoints: _tutorialPts.length,
                recordingPoints: _recordingPts.length,
                canSave: _loadedRecordingId != null &&
                    _tutorialPts.length == _recordingPts.length &&
                    _tutorialPts.length >= Aligner.minPoints,
                onUndo: (_tutorialPts.isEmpty && _recordingPts.isEmpty)
                    ? null
                    : _undoLast,
                onClear: (_tutorialPts.isEmpty && _recordingPts.isEmpty)
                    ? null
                    : _clearAll,
                onSave: _save,
                rms: _lastRms,
                statusText: _statusText,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _toggleEngine(MediaKitVideoEngine engine) {
    // Best-effort toggle without subscribing per-engine; the position stream
    // tells us when something happens. media_kit's `Player` is happy to
    // play/pause idempotently.
    unawaited(engine.play().then((_) {}, onError: (_) {}));
  }
}

final _recordingsListProvider =
    FutureProvider.family<List<RecordingMedia>, TutorialId>((ref, id) async {
  final repo = ref.watch(mediaRepositoryProvider);
  return repo.listRecordings(id);
});

class _RecordingPicker extends StatelessWidget {
  const _RecordingPicker({
    required this.recordings,
    required this.selectedId,
    required this.onChanged,
  });

  final List<RecordingMedia> recordings;
  final RecordingId? selectedId;
  final ValueChanged<RecordingId?> onChanged;

  @override
  Widget build(BuildContext context) {
    if (recordings.isEmpty) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Text(
            'No recordings yet. Record yourself in Practice first, then come '
            'back here to align.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ),
      );
    }
    return Row(
      children: <Widget>[
        const Text('Recording: '),
        const SizedBox(width: 8),
        Expanded(
          child: DropdownButton<RecordingId>(
            isExpanded: true,
            value: selectedId,
            hint: const Text('Pick a recording to align'),
            items: <DropdownMenuItem<RecordingId>>[
              for (final r in recordings)
                DropdownMenuItem<RecordingId>(
                  value: r.id,
                  child: Text(_label(r)),
                ),
            ],
            onChanged: onChanged,
          ),
        ),
      ],
    );
  }

  String _label(RecordingMedia r) {
    final secs = r.duration.inSeconds;
    final ts =
        r.createdAt.toIso8601String().substring(0, 16).replaceAll('T', ' ');
    return '$ts · ${secs}s · ${r.type.name}';
  }
}

class _AlignmentPanel extends StatelessWidget {
  const _AlignmentPanel({
    required this.title,
    required this.engine,
    required this.position,
    required this.duration,
    required this.points,
    required this.onTap,
    required this.onSeek,
    required this.onTogglePlay,
    required this.isLoaded,
    required this.emptyMessage,
  });

  final String title;
  final VideoEngine engine;
  final Duration position;
  final Duration duration;
  final List<Point2> points;
  final void Function(Offset local, Size size) onTap;
  final ValueChanged<Duration> onSeek;
  final VoidCallback onTogglePlay;
  final bool isLoaded;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Row(
              children: <Widget>[
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const Spacer(),
                Text(
                  '${points.length} pt${points.length == 1 ? '' : 's'}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          AspectRatio(
            aspectRatio: 16 / 9,
            child: LayoutBuilder(
              builder: (context, constraints) {
                final size = Size(constraints.maxWidth, constraints.maxHeight);
                return Stack(
                  fit: StackFit.expand,
                  children: <Widget>[
                    if (isLoaded)
                      MediaKitVideoView(engine: engine)
                    else
                      ColoredBox(
                        color: Theme.of(context)
                            .colorScheme
                            .surfaceContainerHighest,
                        child: Center(child: Text(emptyMessage)),
                      ),
                    Positioned.fill(
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTapDown: isLoaded
                            ? (d) => onTap(d.localPosition, size)
                            : null,
                        child: CustomPaint(
                          painter: _PointsPainter(
                            points: points,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
          if (isLoaded)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Row(
                children: <Widget>[
                  IconButton(
                    onPressed: onTogglePlay,
                    icon: const Icon(Icons.play_arrow),
                    tooltip: 'Play (tap again to pause)',
                  ),
                  Expanded(
                    child: Slider(
                      value: _safeValue(position, duration),
                      max: duration.inMilliseconds <= 0
                          ? 1
                          : duration.inMilliseconds.toDouble(),
                      onChanged: duration.inMilliseconds <= 0
                          ? null
                          : (v) => onSeek(Duration(milliseconds: v.round())),
                    ),
                  ),
                  Text(_fmt(position)),
                ],
              ),
            ),
        ],
      ),
    );
  }

  double _safeValue(Duration pos, Duration dur) {
    if (dur.inMilliseconds <= 0) return 0;
    return pos.inMilliseconds.clamp(0, dur.inMilliseconds).toDouble();
  }

  String _fmt(Duration d) {
    final s = d.inSeconds;
    final ms = (d.inMilliseconds % 1000) ~/ 100;
    return '${s}.${ms}s';
  }
}

class _PointsPainter extends CustomPainter {
  _PointsPainter({required this.points, required this.color});

  final List<Point2> points;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final fill = Paint()..color = color;
    final stroke = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    const textStyle = TextStyle(
      color: Colors.white,
      fontWeight: FontWeight.bold,
      fontSize: 12,
    );
    for (var i = 0; i < points.length; i++) {
      final p = points[i];
      final c = Offset(p.x * size.width, p.y * size.height);
      canvas.drawCircle(c, 10, fill);
      canvas.drawCircle(c, 10, stroke);
      final tp = TextPainter(
        text: TextSpan(text: '${i + 1}', style: textStyle),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, c - Offset(tp.width / 2, tp.height / 2));
    }
  }

  @override
  bool shouldRepaint(covariant _PointsPainter old) =>
      old.points.length != points.length || old.color != color;
}

class _ControlBar extends StatelessWidget {
  const _ControlBar({
    required this.tutorialPoints,
    required this.recordingPoints,
    required this.canSave,
    required this.onUndo,
    required this.onClear,
    required this.onSave,
    required this.rms,
    required this.statusText,
  });

  final int tutorialPoints;
  final int recordingPoints;
  final bool canSave;
  final VoidCallback? onUndo;
  final VoidCallback? onClear;
  final VoidCallback onSave;
  final double? rms;
  final String? statusText;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Text(
                  'Tutorial: $tutorialPoints / $recordingPoints :Recording',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: onUndo,
                  icon: const Icon(Icons.undo),
                  label: const Text('Undo'),
                ),
                TextButton.icon(
                  onPressed: onClear,
                  icon: const Icon(Icons.clear_all),
                  label: const Text('Clear'),
                ),
                FilledButton.icon(
                  onPressed: canSave ? onSave : null,
                  icon: const Icon(Icons.save_outlined),
                  label: const Text('Save preset'),
                ),
              ],
            ),
            if (statusText != null) ...<Widget>[
              const SizedBox(height: 8),
              Text(
                statusText!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: rms == null
                          ? Theme.of(context).colorScheme.error
                          : Theme.of(context).colorScheme.primary,
                    ),
              ),
            ],
            const SizedBox(height: 4),
            Text(
              'Tap matching landmarks on each panel: head, shoulders, hips, '
              'hands, feet — at least 3, ideally 5.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}
