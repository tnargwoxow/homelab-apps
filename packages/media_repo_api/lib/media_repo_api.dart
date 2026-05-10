/// Public interface for storing/listing tutorial videos and user recordings.
///
/// Backed by local FS today (mobile) / OPFS (web). Designed so a remote impl
/// can be added later without changing call sites.
library media_repo_api;

import 'dart:typed_data';

import 'package:core_api/core_api.dart';
import 'package:meta/meta.dart';

@immutable
class TutorialMedia {
  const TutorialMedia({
    required this.id,
    required this.title,
    required this.ref,
    required this.duration,
    this.thumbnailRef,
  });

  final TutorialId id;
  final String title;
  final MediaRef ref;
  final Duration duration;
  final MediaRef? thumbnailRef;
}

enum RecordingType { practice, liveOverlay, aligned }

@immutable
class RecordingMedia {
  const RecordingMedia({
    required this.id,
    required this.tutorialId,
    required this.ref,
    required this.duration,
    required this.type,
    required this.createdAt,
    this.parentRecordingId,
  });

  final RecordingId id;
  final TutorialId tutorialId;
  final MediaRef ref;
  final Duration duration;
  final RecordingType type;
  final DateTime createdAt;
  final RecordingId? parentRecordingId;
}

abstract interface class MediaRepository {
  Future<TutorialMedia> saveTutorial({
    required String title,
    required MediaRef sourceRef,
  });

  Future<RecordingMedia> saveRecording({
    required TutorialId tutorialId,
    required MediaRef sourceRef,
    required Duration duration,
    required RecordingType type,
    RecordingId? parentRecordingId,
  });

  Future<List<TutorialMedia>> listTutorials();
  Future<List<RecordingMedia>> listRecordings(TutorialId tutorialId);

  Future<TutorialMedia?> getTutorial(TutorialId id);
  Future<RecordingMedia?> getRecording(RecordingId id);

  /// Streams the raw bytes of a media reference. Implementations may chunk.
  Stream<Uint8List> openStream(MediaRef ref);

  Future<void> deleteTutorial(TutorialId id);
  Future<void> deleteRecording(RecordingId id);
}
