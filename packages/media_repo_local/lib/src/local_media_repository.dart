import 'dart:async';
import 'dart:io' show File;
import 'dart:typed_data';

import 'package:core_api/core_api.dart';
import 'package:drift/drift.dart'
    show OrderClauseGenerator, OrderingTerm, Value;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:media_repo_api/media_repo_api.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import 'local_media_database.dart';

/// [MediaRepository] backed by the local filesystem (mobile/desktop) for media
/// blobs and a Drift index for metadata. On web, blob persistence falls back
/// to the underlying drift_flutter storage; storing user-picked local files is
/// not supported in Phase 1 (use a network MediaRef instead).
class LocalMediaRepository implements MediaRepository {
  /// Wraps an already-open [LocalMediaDatabase] and a base directory for
  /// blob storage. Tests can pass an in-memory DB and a temp directory.
  LocalMediaRepository(this._db, this._baseDir);

  /// Opens the platform-appropriate persistent DB and resolves the application
  /// support directory for blob storage. On web the directory is ignored.
  static Future<LocalMediaRepository> openDefault() async {
    final db = LocalMediaDatabase.openDefault();
    final dir = kIsWeb ? '' : (await getApplicationSupportDirectory()).path;
    return LocalMediaRepository(db, dir);
  }

  final LocalMediaDatabase _db;
  final String _baseDir;

  String _newId() =>
      DateTime.now().microsecondsSinceEpoch.toRadixString(36) +
      '-' +
      (_seq++).toRadixString(36);
  int _seq = 0;

  Future<String> _ensureSubdir(String name) async {
    if (kIsWeb) {
      return '';
    }
    final dir = p.join(_baseDir, name);
    await File(p.join(dir, '.keep')).parent.create(recursive: true);
    return dir;
  }

  /// Copies the given local file URI into our managed directory and returns
  /// the new path. On web this is unsupported and throws.
  Future<String> _ingestFile({
    required String sourceUri,
    required String targetDir,
    required String idHint,
  }) async {
    if (kIsWeb) {
      throw UnsupportedError(
        'Importing local files on web is not supported in Phase 1. '
        'Use a network MediaRef instead.',
      );
    }
    final src = File(sourceUri);
    if (!src.existsSync()) {
      throw ArgumentError('source file not found: $sourceUri');
    }
    final ext =
        p.extension(sourceUri).isEmpty ? '.bin' : p.extension(sourceUri);
    final dest = p.join(targetDir, '$idHint$ext');
    await src.copy(dest);
    return dest;
  }

  // ---- Tutorials -----------------------------------------------------------

  @override
  Future<TutorialMedia> saveTutorial({
    required String title,
    required MediaRef sourceRef,
  }) async {
    final id = TutorialId(_newId());
    var ref = sourceRef;
    if (sourceRef.sourceType == MediaSourceType.localFile) {
      final dir = await _ensureSubdir('tutorials');
      final newPath = await _ingestFile(
        sourceUri: sourceRef.uri,
        targetDir: dir,
        idHint: id.value,
      );
      ref = MediaRef(uri: newPath, sourceType: MediaSourceType.localFile);
    }
    await _db.into(_db.tutorials).insertOnConflictUpdate(
          TutorialsCompanion(
            id: Value<String>(id.value),
            title: Value<String>(title),
            refUri: Value<String>(ref.uri),
            refSourceType: Value<int>(ref.sourceType.index),
            durationMs: const Value<int>(0),
            thumbnailUri: const Value<String?>(null),
            thumbnailSourceType: const Value<int?>(null),
          ),
        );
    return TutorialMedia(
      id: id,
      title: title,
      ref: ref,
      duration: Duration.zero,
    );
  }

  @override
  Future<List<TutorialMedia>> listTutorials() async {
    final rows = await _db.select(_db.tutorials).get();
    return rows.map(_toTutorialMedia).toList(growable: false);
  }

  @override
  Future<TutorialMedia?> getTutorial(TutorialId id) async {
    final row = await (_db.select(_db.tutorials)
          ..where(($TutorialsTable t) => t.id.equals(id.value)))
        .getSingleOrNull();
    return row == null ? null : _toTutorialMedia(row);
  }

  @override
  Future<void> deleteTutorial(TutorialId id) async {
    final row = await (_db.select(_db.tutorials)
          ..where(($TutorialsTable t) => t.id.equals(id.value)))
        .getSingleOrNull();
    if (row != null &&
        MediaSourceType.values[row.refSourceType] ==
            MediaSourceType.localFile &&
        !kIsWeb) {
      final f = File(row.refUri);
      if (f.existsSync()) {
        await f.delete();
      }
    }
    await (_db.delete(_db.tutorials)
          ..where(($TutorialsTable t) => t.id.equals(id.value)))
        .go();
    await (_db.delete(_db.recordings)
          ..where(($RecordingsTable t) => t.tutorialId.equals(id.value)))
        .go();
  }

  TutorialMedia _toTutorialMedia(TutorialRow r) => TutorialMedia(
        id: TutorialId(r.id),
        title: r.title,
        ref: MediaRef(
          uri: r.refUri,
          sourceType: MediaSourceType.values[r.refSourceType],
        ),
        duration: Duration(milliseconds: r.durationMs),
        thumbnailRef: r.thumbnailUri == null || r.thumbnailSourceType == null
            ? null
            : MediaRef(
                uri: r.thumbnailUri!,
                sourceType: MediaSourceType.values[r.thumbnailSourceType!],
              ),
      );

  // ---- Recordings ----------------------------------------------------------

  @override
  Future<RecordingMedia> saveRecording({
    required TutorialId tutorialId,
    required MediaRef sourceRef,
    required Duration duration,
    required RecordingType type,
    RecordingId? parentRecordingId,
  }) async {
    final id = RecordingId(_newId());
    var ref = sourceRef;
    if (sourceRef.sourceType == MediaSourceType.localFile) {
      final dir = await _ensureSubdir('recordings');
      final newPath = await _ingestFile(
        sourceUri: sourceRef.uri,
        targetDir: dir,
        idHint: id.value,
      );
      ref = MediaRef(uri: newPath, sourceType: MediaSourceType.localFile);
    }
    final now = DateTime.now();
    await _db.into(_db.recordings).insertOnConflictUpdate(
          RecordingsCompanion(
            id: Value<String>(id.value),
            tutorialId: Value<String>(tutorialId.value),
            refUri: Value<String>(ref.uri),
            refSourceType: Value<int>(ref.sourceType.index),
            durationMs: Value<int>(duration.inMilliseconds),
            type: Value<int>(type.index),
            createdAt: Value<DateTime>(now),
            parentRecordingId: Value<String?>(parentRecordingId?.value),
          ),
        );
    return RecordingMedia(
      id: id,
      tutorialId: tutorialId,
      ref: ref,
      duration: duration,
      type: type,
      createdAt: now,
      parentRecordingId: parentRecordingId,
    );
  }

  @override
  Future<List<RecordingMedia>> listRecordings(TutorialId tutorialId) async {
    final query = _db.select(_db.recordings)
      ..where(($RecordingsTable t) => t.tutorialId.equals(tutorialId.value))
      ..orderBy(<OrderClauseGenerator<$RecordingsTable>>[
        ($RecordingsTable t) => OrderingTerm.desc(t.createdAt),
      ]);
    final rows = await query.get();
    return rows.map(_toRecordingMedia).toList(growable: false);
  }

  @override
  Future<RecordingMedia?> getRecording(RecordingId id) async {
    final row = await (_db.select(_db.recordings)
          ..where(($RecordingsTable t) => t.id.equals(id.value)))
        .getSingleOrNull();
    return row == null ? null : _toRecordingMedia(row);
  }

  @override
  Future<void> deleteRecording(RecordingId id) async {
    final row = await (_db.select(_db.recordings)
          ..where(($RecordingsTable t) => t.id.equals(id.value)))
        .getSingleOrNull();
    if (row != null &&
        MediaSourceType.values[row.refSourceType] ==
            MediaSourceType.localFile &&
        !kIsWeb) {
      final f = File(row.refUri);
      if (f.existsSync()) {
        await f.delete();
      }
    }
    await (_db.delete(_db.recordings)
          ..where(($RecordingsTable t) => t.id.equals(id.value)))
        .go();
  }

  RecordingMedia _toRecordingMedia(RecordingRow r) => RecordingMedia(
        id: RecordingId(r.id),
        tutorialId: TutorialId(r.tutorialId),
        ref: MediaRef(
          uri: r.refUri,
          sourceType: MediaSourceType.values[r.refSourceType],
        ),
        duration: Duration(milliseconds: r.durationMs),
        type: RecordingType.values[r.type],
        createdAt: r.createdAt,
        parentRecordingId: r.parentRecordingId == null
            ? null
            : RecordingId(r.parentRecordingId!),
      );

  // ---- Streaming -----------------------------------------------------------

  @override
  Stream<Uint8List> openStream(MediaRef ref) async* {
    if (ref.sourceType == MediaSourceType.localFile && !kIsWeb) {
      yield* File(ref.uri).openRead().map(Uint8List.fromList);
    } else {
      // For network and asset refs the consumer (media_kit, http) already
      // handles streaming. We yield nothing; callers should hand the URI off
      // to a player or HTTP client instead.
      yield Uint8List(0);
    }
  }

  /// Releases underlying resources.
  Future<void> close() => _db.close();
}
