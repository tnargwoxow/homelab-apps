import 'package:core_api/core_api.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_repo_api/media_repo_api.dart';

import '../../composition_root.dart';

/// The currently selected tutorial. Library taps will write this; the player
/// screen watches it. Phase 1 wiring keeps this null by default and the
/// player shows an empty state.
final selectedTutorialIdProvider = StateProvider<TutorialId?>((ref) => null);

/// Shared "recordings for a tutorial" provider. Practice (which creates new
/// recordings) and Align (which picks one to mark up) read this so the
/// dropdown / list updates as soon as the writer calls
/// `ref.invalidate(tutorialRecordingsProvider(id))`.
final tutorialRecordingsProvider =
    FutureProvider.family<List<RecordingMedia>, TutorialId>(
  (ref, id) async => ref.watch(mediaRepositoryProvider).listRecordings(id),
);
