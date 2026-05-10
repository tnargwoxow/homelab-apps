import 'dart:typed_data';

import 'package:core_api/core_api.dart';
import 'package:media_repo_api/media_repo_api.dart';

class FakeMediaRepository implements MediaRepository {
  FakeMediaRepository({List<TutorialMedia>? seedTutorials})
      : _tutorials = <TutorialId, TutorialMedia>{
          for (final t in seedTutorials ?? const <TutorialMedia>[]) t.id: t,
        };

  final Map<TutorialId, TutorialMedia> _tutorials;
  final Map<TutorialId, List<RecordingMedia>> _recordings =
      <TutorialId, List<RecordingMedia>>{};

  int _nextId = 0;
  String _id() => 'fake-${_nextId++}';

  @override
  Future<TutorialMedia> saveTutorial({
    required String title,
    required MediaRef sourceRef,
  }) async {
    final id = TutorialId(_id());
    final media = TutorialMedia(
      id: id,
      title: title,
      ref: sourceRef,
      duration: const Duration(minutes: 3),
    );
    _tutorials[id] = media;
    return media;
  }

  @override
  Future<RecordingMedia> saveRecording({
    required TutorialId tutorialId,
    required MediaRef sourceRef,
    required Duration duration,
    required RecordingType type,
    RecordingId? parentRecordingId,
  }) async {
    final id = RecordingId(_id());
    final media = RecordingMedia(
      id: id,
      tutorialId: tutorialId,
      ref: sourceRef,
      duration: duration,
      type: type,
      createdAt: DateTime.now(),
      parentRecordingId: parentRecordingId,
    );
    _recordings.putIfAbsent(tutorialId, () => <RecordingMedia>[]).add(media);
    return media;
  }

  @override
  Future<List<TutorialMedia>> listTutorials() async =>
      _tutorials.values.toList(growable: false);

  @override
  Future<List<RecordingMedia>> listRecordings(TutorialId tutorialId) async =>
      List<RecordingMedia>.unmodifiable(
          _recordings[tutorialId] ?? const <RecordingMedia>[]);

  @override
  Future<TutorialMedia?> getTutorial(TutorialId id) async => _tutorials[id];

  @override
  Future<RecordingMedia?> getRecording(RecordingId id) async {
    for (final list in _recordings.values) {
      for (final r in list) {
        if (r.id == id) return r;
      }
    }
    return null;
  }

  @override
  Stream<Uint8List> openStream(MediaRef ref) async* {
    yield Uint8List(0);
  }

  @override
  Future<void> deleteTutorial(TutorialId id) async {
    _tutorials.remove(id);
    _recordings.remove(id);
  }

  @override
  Future<void> deleteRecording(RecordingId id) async {
    for (final list in _recordings.values) {
      list.removeWhere((r) => r.id == id);
    }
  }
}
