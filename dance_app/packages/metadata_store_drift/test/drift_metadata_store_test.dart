import 'package:core_api/core_api.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:metadata_store_api/metadata_store_api.dart';
import 'package:metadata_store_drift/metadata_store_drift.dart';

void main() {
  late DriftMetadataDatabase db;
  late DriftMetadataStore store;

  setUp(() {
    db = DriftMetadataDatabase(NativeDatabase.memory());
    store = DriftMetadataStore(db);
  });

  tearDown(() async {
    await db.close();
  });

  test('roundtrip loop marker', () async {
    const id = TutorialId('t1');
    const marker = LoopMarker(
      id: 'm1',
      tutorialId: id,
      label: 'chorus',
      start: Duration(seconds: 1),
      end: Duration(seconds: 5),
    );
    await store.upsertLoopMarker(marker);
    final got = await store.loopMarkersFor(id);
    expect(got.length, 1);
    expect(got.first.label, 'chorus');
    expect(got.first.start, const Duration(seconds: 1));
    expect(got.first.end, const Duration(seconds: 5));
  });

  test('settings default + write/read', () async {
    final initial = await store.readSettings();
    expect(
        initial.defaultPlaybackRate, UserSettings.defaults.defaultPlaybackRate);
    await store.writeSettings(
      const UserSettings(
        defaultPlaybackRate: 0.5,
        mirrorCameraOverlay: false,
        overlayOpacity: 0.25,
      ),
    );
    final got = await store.readSettings();
    expect(got.defaultPlaybackRate, 0.5);
    expect(got.mirrorCameraOverlay, false);
    expect(got.overlayOpacity, 0.25);
  });
}
