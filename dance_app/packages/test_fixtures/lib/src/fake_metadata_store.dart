import 'package:core_api/core_api.dart';
import 'package:metadata_store_api/metadata_store_api.dart';

class FakeMetadataStore implements MetadataStore {
  FakeMetadataStore();

  final Map<String, LoopMarker> _loops = <String, LoopMarker>{};
  final List<PracticeSession> _sessions = <PracticeSession>[];
  final Map<RecordingId, AlignmentPreset> _presets =
      <RecordingId, AlignmentPreset>{};
  UserSettings _settings = UserSettings.defaults;

  @override
  Future<void> upsertLoopMarker(LoopMarker marker) async {
    _loops[marker.id] = marker;
  }

  @override
  Future<List<LoopMarker>> loopMarkersFor(TutorialId tutorialId) async => _loops
      .values
      .where((m) => m.tutorialId == tutorialId)
      .toList(growable: false);

  @override
  Future<void> deleteLoopMarker(String id) async {
    _loops.remove(id);
  }

  @override
  Future<void> recordSession(PracticeSession session) async {
    _sessions.add(session);
  }

  @override
  Future<List<PracticeSession>> sessionsFor(TutorialId tutorialId) async =>
      _sessions
          .where((s) => s.tutorialId == tutorialId)
          .toList(growable: false);

  @override
  Future<List<PracticeSession>> sessionsBetween(
    DateTime from,
    DateTime to,
  ) async =>
      _sessions
          .where((s) => !s.startedAt.isBefore(from) && !s.startedAt.isAfter(to))
          .toList(growable: false);

  @override
  Future<void> upsertAlignmentPreset(AlignmentPreset preset) async {
    _presets[preset.recordingId] = preset;
  }

  @override
  Future<AlignmentPreset?> alignmentFor(RecordingId recordingId) async =>
      _presets[recordingId];

  @override
  Future<UserSettings> readSettings() async => _settings;

  @override
  Future<void> writeSettings(UserSettings settings) async {
    _settings = settings;
  }
}
