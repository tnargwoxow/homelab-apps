import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

part 'local_media_database.g.dart';

/// Tutorial index rows (one per imported tutorial).
@DataClassName('TutorialRow')
class Tutorials extends Table {
  TextColumn get id => text()();
  TextColumn get title => text()();
  TextColumn get refUri => text()();
  IntColumn get refSourceType => integer()(); // MediaSourceType.index
  IntColumn get durationMs => integer()();
  TextColumn get thumbnailUri => text().nullable()();
  IntColumn get thumbnailSourceType => integer().nullable()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}

/// Recording index rows (one per saved practice recording).
@DataClassName('RecordingRow')
class Recordings extends Table {
  TextColumn get id => text()();
  TextColumn get tutorialId => text()();
  TextColumn get refUri => text()();
  IntColumn get refSourceType => integer()();
  IntColumn get durationMs => integer()();
  IntColumn get type => integer()(); // RecordingType.index
  DateTimeColumn get createdAt => dateTime()();
  TextColumn get parentRecordingId => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}

@DriftDatabase(tables: <Type>[Tutorials, Recordings])
class LocalMediaDatabase extends _$LocalMediaDatabase {
  LocalMediaDatabase(super.e);

  /// Open a default platform-appropriate database file via [drift_flutter].
  LocalMediaDatabase.openDefault()
      : super(driftDatabase(name: 'dance_app_media'));

  @override
  int get schemaVersion => 1;
}
