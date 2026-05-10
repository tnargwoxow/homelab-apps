import 'dart:async';

import 'package:core_api/core_api.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:video_engine_api/video_engine_api.dart';

/// A [VideoEngine] backed by media_kit / libmpv.
///
/// On native platforms libmpv is used directly. On the web, media_kit falls
/// back to the platform's HTMLMediaElement, which means pitch preservation is
/// browser-dependent.
class MediaKitVideoEngine implements VideoEngine {
  /// Creates the engine and an underlying media_kit [Player]. Call
  /// [ensureInitialized] once at app startup before constructing.
  MediaKitVideoEngine() : _player = Player() {
    _videoController = VideoController(_player);
    _wirePlayerStreams();
  }

  /// Initializes the media_kit native bindings. Safe to call repeatedly.
  static void ensureInitialized() {
    if (_initialized) {
      return;
    }
    MediaKit.ensureInitialized();
    _initialized = true;
  }

  static bool _initialized = false;

  final Player _player;
  late final VideoController _videoController;

  final StreamController<Duration> _positionController =
      StreamController<Duration>.broadcast();
  final StreamController<PlaybackState> _stateController =
      StreamController<PlaybackState>.broadcast();

  StreamSubscription<Duration>? _positionSub;
  StreamSubscription<bool>? _playingSub;
  StreamSubscription<bool>? _completedSub;
  StreamSubscription<bool>? _bufferingSub;
  StreamSubscription<Duration>? _durationSub;

  Duration _duration = Duration.zero;
  Duration _lastPosition = Duration.zero;
  LoopRange? _loop;
  bool _seekingForLoop = false;
  PlaybackState _lastState = PlaybackState.idle;

  /// The underlying media_kit [VideoController]. Used by
  /// `MediaKitVideoView` to render frames.
  VideoController get videoController => _videoController;

  void _wirePlayerStreams() {
    _positionSub = _player.stream.position.listen((p) {
      _lastPosition = p;
      _positionController.add(p);
      _maybeLoopBack(p);
    });
    _playingSub = _player.stream.playing.listen((playing) {
      if (playing) {
        _emitState(PlaybackState.playing);
      } else if (_lastState != PlaybackState.ended &&
          _lastState != PlaybackState.loading) {
        _emitState(PlaybackState.paused);
      }
    });
    _completedSub = _player.stream.completed.listen((completed) {
      if (completed) {
        _emitState(PlaybackState.ended);
      }
    });
    _bufferingSub = _player.stream.buffering.listen((buffering) {
      if (buffering) {
        _emitState(PlaybackState.loading);
      }
    });
    _durationSub = _player.stream.duration.listen((d) {
      _duration = d;
    });
  }

  void _emitState(PlaybackState s) {
    _lastState = s;
    _stateController.add(s);
  }

  void _maybeLoopBack(Duration current) {
    final loop = _loop;
    if (loop == null || _seekingForLoop) {
      return;
    }
    if (current >= loop.end) {
      _seekingForLoop = true;
      // Fire-and-forget; we clear the guard once seek resolves.
      unawaited(
        _player.seek(loop.start).whenComplete(() {
          _seekingForLoop = false;
        }),
      );
    }
  }

  Media _toMedia(MediaRef ref) {
    switch (ref.sourceType) {
      case MediaSourceType.localFile:
        return Media(ref.uri);
      case MediaSourceType.network:
        return Media(ref.uri);
      case MediaSourceType.asset:
        // media_kit treats `asset:///` URIs as Flutter assets.
        final uri =
            ref.uri.startsWith('asset:///') ? ref.uri : 'asset:///${ref.uri}';
        return Media(uri);
    }
  }

  @override
  Duration get duration => _duration;

  @override
  Stream<Duration> get position => _positionController.stream;

  @override
  Stream<PlaybackState> get state => _stateController.stream;

  @override
  Future<void> load(MediaRef ref) async {
    _emitState(PlaybackState.loading);
    await _player.open(_toMedia(ref), play: false);
    _emitState(PlaybackState.paused);
  }

  @override
  Future<void> play() async {
    await _player.play();
  }

  @override
  Future<void> pause() async {
    await _player.pause();
  }

  @override
  Future<void> seek(Duration position) async {
    await _player.seek(position);
    _lastPosition = position;
    _positionController.add(position);
  }

  @override
  Future<void> setRate(double rate, {bool preservePitch = true}) async {
    // libmpv preserves pitch via `audio-pitch-correction`, which is on by
    // default. media_kit does not expose a setter for it in its public API,
    // so we rely on the default. When [preservePitch] is false we cannot
    // currently disable correction from this side; setting rate alone is
    // acceptable for Phase 1.
    await _player.setRate(rate);
  }

  @override
  Future<void> setLoop(LoopRange? range) async {
    _loop = range;
    // The position stream listener already enforces the loop; clearing is
    // just resetting the field above. No additional subscription work needed.
  }

  @override
  Future<void> dispose() async {
    await _positionSub?.cancel();
    await _playingSub?.cancel();
    await _completedSub?.cancel();
    await _bufferingSub?.cancel();
    await _durationSub?.cancel();
    await _positionController.close();
    await _stateController.close();
    await _player.dispose();
  }

  /// Last known position. Exposed for the render widget so it can pair
  /// position updates with frame timestamps without a stream subscription.
  Duration get lastPosition => _lastPosition;
}
