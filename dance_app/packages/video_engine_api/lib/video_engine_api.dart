/// Public interface for the video engine. Multiple instances must coexist
/// (used for ghost playback where tutorial and recording play in lockstep).
library video_engine_api;

import 'package:core_api/core_api.dart';
import 'package:meta/meta.dart';

@immutable
class LoopRange {
  const LoopRange({required this.start, required this.end});
  final Duration start;
  final Duration end;

  Duration get length => end - start;
}

enum PlaybackState { idle, loading, playing, paused, ended, error }

abstract interface class VideoEngine {
  Future<void> load(MediaRef ref);
  Future<void> play();
  Future<void> pause();
  Future<void> seek(Duration position);

  /// Sets the playback rate. When [preservePitch] is true, audio is
  /// time-stretched so pitch is preserved. media_kit / libmpv supports this
  /// natively on mobile; web is browser-dependent.
  Future<void> setRate(double rate, {bool preservePitch = true});

  /// Sets an A/B loop. Pass null to clear.
  Future<void> setLoop(LoopRange? range);

  Stream<Duration> get position;
  Stream<PlaybackState> get state;
  Duration get duration;

  Future<void> dispose();
}
