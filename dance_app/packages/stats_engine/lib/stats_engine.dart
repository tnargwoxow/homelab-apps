/// Aggregations over PracticeSessions. Pure Dart.
library stats_engine;

import 'package:core_api/core_api.dart';
import 'package:meta/meta.dart';
import 'package:metadata_store_api/metadata_store_api.dart';

@immutable
class TutorialStats {
  const TutorialStats({
    required this.tutorialId,
    required this.sessionCount,
    required this.totalActive,
    required this.recordingCount,
  });
  final TutorialId tutorialId;
  final int sessionCount;
  final Duration totalActive;
  final int recordingCount;
}

@immutable
class DailyTotal {
  const DailyTotal({required this.day, required this.totalActive});
  final DateTime day;
  final Duration totalActive;
}

class StatsEngine {
  const StatsEngine();

  TutorialStats summariseTutorial(
    TutorialId tutorialId,
    List<PracticeSession> sessions,
  ) {
    var totalMs = 0;
    var recordingCount = 0;
    for (final s in sessions) {
      totalMs += s.totalActive.inMilliseconds;
      if (s.recordingId != null) recordingCount++;
    }
    return TutorialStats(
      tutorialId: tutorialId,
      sessionCount: sessions.length,
      totalActive: Duration(milliseconds: totalMs),
      recordingCount: recordingCount,
    );
  }

  List<DailyTotal> dailyTotals(List<PracticeSession> sessions) {
    final byDay = <DateTime, int>{};
    for (final s in sessions) {
      final d = DateTime(s.startedAt.year, s.startedAt.month, s.startedAt.day);
      byDay.update(
        d,
        (existing) => existing + s.totalActive.inMilliseconds,
        ifAbsent: () => s.totalActive.inMilliseconds,
      );
    }
    final entries = byDay.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    return <DailyTotal>[
      for (final e in entries)
        DailyTotal(day: e.key, totalActive: Duration(milliseconds: e.value)),
    ];
  }
}
