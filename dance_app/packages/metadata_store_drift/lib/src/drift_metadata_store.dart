import 'package:core_api/core_api.dart';
import 'package:drift/drift.dart';
import 'package:metadata_store_api/metadata_store_api.dart';

import 'database.dart';

/// [MetadataStore] implementation backed by a [DriftMetadataDatabase].
///
/// Tests can pass an in-memory database; production code should use
/// [DriftMetadataStore.openDefault].
class DriftMetadataStore implements MetadataStore {
  /// Wraps an already-constructed [DriftMetadataDatabase].
  DriftMetadataStore(this._db);

  final DriftMetadataDatabase _db;

  /// Opens the platform-appropriate persistent database via drift_flutter.
  static Future<DriftMetadataStore> openDefault() async {
    return DriftMetadataStore(DriftMetadataDatabase.openDefault());
  }

  /// Releases underlying database resources.
  Future<void> close() => _db.close();

  // ---- Loop markers --------------------------------------------------------

  @override
  Future<void> upsertLoopMarker(LoopMarker marker) async {
    await _db.into(_db.loopMarkers).insertOnConflictUpdate(
          LoopMarkerRow(
            id: marker.id,
            tutorialId: marker.tutorialId.value,
            label: marker.label,
            startMs: marker.start.inMilliseconds,
            endMs: marker.end.inMilliseconds,
          ),
        );
  }

  @override
  Future<List<LoopMarker>> loopMarkersFor(TutorialId tutorialId) async {
    final query = _db.select(_db.loopMarkers)
      ..where(($LoopMarkersTable t) => t.tutorialId.equals(tutorialId.value));
    final rows = await query.get();
    return rows
        .map(
          (LoopMarkerRow r) => LoopMarker(
            id: r.id,
            tutorialId: TutorialId(r.tutorialId),
            label: r.label,
            start: Duration(milliseconds: r.startMs),
            end: Duration(milliseconds: r.endMs),
          ),
        )
        .toList(growable: false);
  }

  @override
  Future<void> deleteLoopMarker(String id) async {
    await (_db.delete(_db.loopMarkers)
          ..where(($LoopMarkersTable t) => t.id.equals(id)))
        .go();
  }

  // ---- Sessions ------------------------------------------------------------

  @override
  Future<void> recordSession(PracticeSession session) async {
    await _db.into(_db.practiceSessionsTable).insertOnConflictUpdate(
          PracticeSessionRow(
            id: session.id.value,
            tutorialId: session.tutorialId.value,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            totalActiveMs: session.totalActive.inMilliseconds,
            mode: session.mode.index,
            loopCount: session.loopCount,
            avgSpeed: session.avgSpeed,
            recordingId: session.recordingId?.value,
          ),
        );
  }

  @override
  Future<List<PracticeSession>> sessionsFor(TutorialId tutorialId) async {
    final query = _db.select(_db.practiceSessionsTable)
      ..where(
        ($PracticeSessionsTableTable t) =>
            t.tutorialId.equals(tutorialId.value),
      );
    final rows = await query.get();
    return rows.map(_toSession).toList(growable: false);
  }

  @override
  Future<List<PracticeSession>> sessionsBetween(
    DateTime from,
    DateTime to,
  ) async {
    final query = _db.select(_db.practiceSessionsTable)
      ..where(
        ($PracticeSessionsTableTable t) =>
            t.startedAt.isBiggerOrEqualValue(from) &
            t.startedAt.isSmallerOrEqualValue(to),
      );
    final rows = await query.get();
    return rows.map(_toSession).toList(growable: false);
  }

  PracticeSession _toSession(PracticeSessionRow r) => PracticeSession(
        id: SessionId(r.id),
        tutorialId: TutorialId(r.tutorialId),
        startedAt: r.startedAt,
        endedAt: r.endedAt,
        totalActive: Duration(milliseconds: r.totalActiveMs),
        mode: SessionMode.values[r.mode],
        loopCount: r.loopCount,
        avgSpeed: r.avgSpeed,
        recordingId: r.recordingId == null ? null : RecordingId(r.recordingId!),
      );

  // ---- Alignment presets ---------------------------------------------------

  @override
  Future<void> upsertAlignmentPreset(AlignmentPreset preset) async {
    await _db.into(_db.alignmentPresetsTable).insertOnConflictUpdate(
          AlignmentPresetRow(
            id: preset.id,
            recordingId: preset.recordingId.value,
            tutorialId: preset.tutorialId.value,
            tutorialKeyframeMs: preset.tutorialKeyframeMs,
            recordingKeyframeMs: preset.recordingKeyframeMs,
            matrixCsv: preset.matrix.join(','),
            isAi: preset.isAi,
            createdAt: preset.createdAt,
          ),
        );
  }

  @override
  Future<AlignmentPreset?> alignmentFor(RecordingId recordingId) async {
    final query = _db.select(_db.alignmentPresetsTable)
      ..where(
        ($AlignmentPresetsTableTable t) =>
            t.recordingId.equals(recordingId.value),
      )
      ..orderBy(<OrderClauseGenerator<$AlignmentPresetsTableTable>>[
        ($AlignmentPresetsTableTable t) => OrderingTerm.desc(t.createdAt),
      ])
      ..limit(1);
    final row = await query.getSingleOrNull();
    if (row == null) {
      return null;
    }
    return AlignmentPreset(
      id: row.id,
      recordingId: RecordingId(row.recordingId),
      tutorialId: TutorialId(row.tutorialId),
      tutorialKeyframeMs: row.tutorialKeyframeMs,
      recordingKeyframeMs: row.recordingKeyframeMs,
      matrix:
          row.matrixCsv.split(',').map(double.parse).toList(growable: false),
      isAi: row.isAi,
      createdAt: row.createdAt,
    );
  }

  // ---- Settings ------------------------------------------------------------

  @override
  Future<UserSettings> readSettings() async {
    final row = await (_db.select(_db.userSettingsTable)
          ..where(($UserSettingsTableTable t) => t.id.equals(0)))
        .getSingleOrNull();
    if (row == null) {
      return UserSettings.defaults;
    }
    return UserSettings(
      defaultPlaybackRate: row.defaultPlaybackRate,
      mirrorCameraOverlay: row.mirrorCameraOverlay,
      overlayOpacity: row.overlayOpacity,
    );
  }

  @override
  Future<void> writeSettings(UserSettings settings) async {
    await _db.into(_db.userSettingsTable).insertOnConflictUpdate(
          UserSettingsRow(
            id: 0,
            defaultPlaybackRate: settings.defaultPlaybackRate,
            mirrorCameraOverlay: settings.mirrorCameraOverlay,
            overlayOpacity: settings.overlayOpacity,
          ),
        );
  }
}
