import 'dart:async';

import 'package:core_api/core_api.dart';
import 'package:video_engine_api/video_engine_api.dart';

class FakeVideoEngine implements VideoEngine {
  FakeVideoEngine();

  final StreamController<Duration> _position =
      StreamController<Duration>.broadcast();
  final StreamController<PlaybackState> _state =
      StreamController<PlaybackState>.broadcast();

  Duration _duration = const Duration(minutes: 3);
  Duration _current = Duration.zero;
  LoopRange? _loop;
  double _rate = 1.0;
  Timer? _ticker;

  @override
  Duration get duration => _duration;

  @override
  Stream<Duration> get position => _position.stream;

  @override
  Stream<PlaybackState> get state => _state.stream;

  @override
  Future<void> load(MediaRef ref) async {
    _state.add(PlaybackState.loading);
    _current = Duration.zero;
    _state.add(PlaybackState.paused);
  }

  @override
  Future<void> play() async {
    _state.add(PlaybackState.playing);
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(milliseconds: 100), (_) {
      _current += Duration(milliseconds: (100 * _rate).round());
      final loop = _loop;
      if (loop != null && _current >= loop.end) {
        _current = loop.start;
      } else if (_current >= _duration) {
        _current = _duration;
        _ticker?.cancel();
        _state.add(PlaybackState.ended);
      }
      _position.add(_current);
    });
  }

  @override
  Future<void> pause() async {
    _ticker?.cancel();
    _state.add(PlaybackState.paused);
  }

  @override
  Future<void> seek(Duration position) async {
    _current = position;
    _position.add(_current);
  }

  @override
  Future<void> setRate(double rate, {bool preservePitch = true}) async {
    _rate = rate;
  }

  @override
  Future<void> setLoop(LoopRange? range) async {
    _loop = range;
  }

  @override
  Future<void> dispose() async {
    _ticker?.cancel();
    await _position.close();
    await _state.close();
  }
}
