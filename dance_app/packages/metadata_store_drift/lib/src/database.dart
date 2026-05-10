import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

part 'database.g.dart';

/// Loop markers anchored to a tutorial.
@DataClassName('LoopMarkerRow')
class LoopMarkers extends Table {
  TextColumn get id => text()();
  TextColumn get tutorialId => text()();
  TextColumn get label => text()();
  IntColumn get startMs => integer()();
  IntColumn get endMs => integer()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}

/// Recorded practice sessions.
@DataClassName('PracticeSessionRow')
class PracticeSessionsTable extends Table {
  TextColumn get id => text()();
  TextColumn get tutorialId => text()();
  DateTimeColumn get startedAt => dateTime()();
  DateTimeColumn get endedAt => dateTime()();
  IntColumn get totalActiveMs => integer()();
  IntColumn get mode => integer()(); // SessionMode.index
  IntColumn get loopCount => integer()();
  RealColumn get avgSpeed => real()();
  TextColumn get recordingId => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}

/// Alignment presets, one per recording (latest-write-wins).
@DataClassName('AlignmentPresetRow')
class AlignmentPresetsTable extends Table {
  TextColumn get id => text()();
  TextColumn get recordingId => text()();
  TextColumn get tutorialId => text()();
  IntColumn get tutorialKeyframeMs => integer()();
  IntColumn get recordingKeyframeMs => integer()();
  TextColumn get matrixCsv => text()();
  BoolColumn get isAi => boolean()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}

/// Single-row settings table (id is always 0).
@DataClassName('UserSettingsRow')
class UserSettingsTable extends Table {
  IntColumn get id => integer().withDefault(const Constant<int>(0))();
  RealColumn get defaultPlaybackRate => real()();
  BoolColumn get mirrorCameraOverlay => boolean()();
  RealColumn get overlayOpacity => real()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}

@DriftDatabase(
  tables: <Type>[
    LoopMarkers,
    PracticeSessionsTable,
    AlignmentPresetsTable,
    UserSettingsTable,
  ],
)
class DriftMetadataDatabase extends _$DriftMetadataDatabase {
  DriftMetadataDatabase(super.e);

  /// Open a default platform-appropriate database file via [drift_flutter].
  DriftMetadataDatabase.openDefault()
      : super(driftDatabase(name: 'dance_app_metadata'));

  @override
  int get schemaVersion => 1;
}
